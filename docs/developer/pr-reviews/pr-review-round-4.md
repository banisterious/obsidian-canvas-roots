# PR Review Round 4 Analysis

**Source:** [PR Comment #3581979376](https://github.com/obsidianmd/obsidian-releases/pull/8689#issuecomment-3581979376)
**Date:** 2025-11-27
**Branch:** `fix/pr-review-round-4`

## Summary

This review contains **required** fixes in 6 categories plus 1 optional fix.

| Category | Count | Severity |
|----------|-------|----------|
| Sentence case for UI text | 165 | Required |
| Unhandled promise | 1 | Required |
| Async method with no await | 2 | Required |
| Unexpected await of non-Promise | 9 | Required |
| Invalid type "never" in template literal | 1 | Required |
| Promise returned where void expected | 3 | Required |
| Unused import | 1 | Optional |

---

## Required Fixes

### 1. Sentence Case for UI Text (165 instances)

All UI text (`.setName()`, buttons, labels, headings) must use sentence case per Obsidian guidelines.

**Files affected:**

| File | Count |
|------|-------|
| main.ts | 49 |
| src/ui/control-center.ts | 103 |
| src/settings.ts | 11 |
| src/ui/canvas-style-modal.ts | 7 |
| src/core/relationship-manager.ts | 5 |
| src/ui/folder-scan-modal.ts | 4 |
| src/gedcom/gedcom-importer.ts | 2 |
| src/ui/relationship-history-modal.ts | 2 |
| src/gedcom/gedcom-exporter.ts | 1 |
| src/ui/gedcom-import-results-modal.ts | 1 |

**Pattern to fix:**
- WRONG: `'Root Person'`, `'Default Node Width'`, `'Tree Configuration'`
- CORRECT: `'Root person'`, `'Default node width'`, `'Tree configuration'`

**Exceptions (keep capitalized):**
- **Proper nouns:** GEDCOM, Canvas, Obsidian, Excalidraw
- **Acronyms:** UUID, ID, PNG, SVG, CSV
- **Technical terms:** Canvas Roots (plugin name), Family Chart (feature name)
- **Format names:** Ahnentafel, d'Aboville, Henry, Modified Register

**Line references for main.ts:**
- L50, L128, L137, L146, L219, L284, L296, L305, L315, L333, L347, L540, L605, L615, L637, L652, L667, L678, L692, L714, L723, L744, L753, L762, L771, L781, L790, L799, L833, L843, L860, L877, L892, L962, L973, L988, L1006, L1015, L1024, L1045, L1410, L1548, L1696, L1786, L1851, L1917, L1929, L2277, L2436

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

---

### 2. Unhandled Promise (1 instance)

**File:** main.ts#L202

Promises must be awaited, end with `.catch()`, end with `.then()` with a rejection handler, or be explicitly marked as ignored with `void`.

**Fix:** Add `void` operator or proper error handling.

---

### 3. Async Method with No Await (2 instances)

**File:** main.ts#L2502
- Method: `showFolderStatistics`
- Fix: Either remove `async` keyword or add await expression

**File:** src/core/lineage-tracking.ts#L269
- Method: `getPersonLineages`
- Fix: Either remove `async` keyword or add await expression

---

### 4. Unexpected Await of Non-Promise (9 instances)

These are `await` expressions on values that are not Promises (non-"Thenable").

**File:** src/core/family-graph.ts (7 instances)
- L148, L212, L230, L276, L347, L385, L888

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

### 6. Promise Returned Where Void Expected (3 instances)

**File:** src/ui/relationship-history-modal.ts
- L201-207
- L234-240
- L297-302

Promise is returned in function argument where void return was expected.

**Fix:** Add `void` operator or handle the promise properly.

---

## Optional Fixes

### 1. Unused Import (1 instance)

**File:** src/ui/relationship-history-modal.ts#L13
- `'HistoryStats'` is defined but never used

**Fix:** Remove the unused import.

---

## Implementation Strategy

### Phase 1: Sentence Case Fixes (Largest batch)
1. Start with main.ts (49 instances)
2. Then control-center.ts (103 instances)
3. Then remaining files

### Phase 2: Promise/Async Fixes
1. Fix unhandled promise in main.ts#L202
2. Remove `async` from methods with no await
3. Remove `await` from non-Promise values
4. Fix promise-in-void-context issues

### Phase 3: Type Fixes
1. Fix "never" type in relationship-history.ts

### Phase 4: Cleanup
1. Remove unused HistoryStats import

---

## Testing Checklist

- [ ] Build passes with no TypeScript errors
- [ ] All UI text displays correctly in sentence case
- [ ] No console errors related to unhandled promises
- [ ] Plugin loads and functions correctly
- [ ] All modals render correctly
- [ ] Settings page displays correctly
