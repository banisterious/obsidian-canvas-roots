# PR Review Round 1 - Sentence Case for UI Text

**Source:** [Obsidian PR Comment #3577414946](https://github.com/obsidianmd/obsidian-releases/pull/8689#issuecomment-3577414946)

**Priority:** Low (UI Consistency)
**Total Issues:** 167
**Category:** Use sentence case for UI text

## Issue Description

UI text should use sentence case (only capitalize the first word and proper nouns) rather than title case or all caps. This maintains consistency with Obsidian's UI guidelines.

## Fix Strategy

Convert UI text strings to sentence case:
- "Root Person" → "Root person"
- "Default Node Width" → "Default node width"
- Keep proper nouns capitalized (e.g., "GEDCOM", "Canvas")

## Files Affected

| File | Count |
|------|-------|
| [main.ts](../../../main.ts) | 35 |
| [src/core/relationship-manager.ts](../../../src/core/relationship-manager.ts) | 5 |
| [src/gedcom/gedcom-exporter.ts](../../../src/gedcom/gedcom-exporter.ts) | 1 |
| [src/gedcom/gedcom-importer.ts](../../../src/gedcom/gedcom-importer.ts) | 2 |
| [src/settings.ts](../../../src/settings.ts) | 4 |
| [src/ui/canvas-style-modal.ts](../../../src/ui/canvas-style-modal.ts) | 7 |
| [src/ui/control-center.ts](../../../src/ui/control-center.ts) | 108 |
| [src/ui/folder-scan-modal.ts](../../../src/ui/folder-scan-modal.ts) | 4 |
| [src/ui/gedcom-import-results-modal.ts](../../../src/ui/gedcom-import-results-modal.ts) | 1 |

**Total**: 167 occurrences across 9 files

## Detailed Line References

### main.ts (35 occurrences)

Lines: 44, 104, 132, 197, 209, 218, 228, 246, 260, 433, 443, 463, 476, 489, 500, 514, 536, 545, 590, 600, 617, 634, 649, 687, 698, 713, 731, 740, 1044, 1153, 1219, 1231, 1579, 1696

### src/core/relationship-manager.ts (5 occurrences)

Lines: 25, 31, 33, 56, 80

### src/gedcom/gedcom-exporter.ts (1 occurrence)

Line: 113

### src/gedcom/gedcom-importer.ts (2 occurrences)

Lines: 146, 163

### src/settings.ts (4 occurrences)

Lines: 226, 227, 251, 352, 354

### src/ui/canvas-style-modal.ts (7 occurrences)

Lines: 74, 91, 107, 123, 143, 163, 178

### src/ui/control-center.ts (108 occurrences)

Lines: 264, 319, 488, 631, 968, 1078, 1095, 1097, 1098, 1101, 1118, 1120, 1121, 1124, 1132, 1133, 1173, 1174, 1184, 1189, 1191, 1205, 1225, 1237, 1238, 1250, 1251, 1252, 1259, 1273, 1286, 1303, 1314, 1337, 1342, 1357, 1358, 1359, 1367, 1368, 1369, 1372, 1373, 1393, 1402, 1403, 1410, 1411, 1436, 1452, 1459, 1460, 1461, 1462, 1468, 1473, 1474, 1480, 1481, 1612, 1648, 1661, 1665, 1681, 1689, 1842, 1843, 1844, 1857, 1858, 1859, 1882, 1883, 1884, 1885, 1918, 1920, 1922, 1923, 1973, 1979, 1983, 1993, 2017, 2021, 2028, 2032, 2057, 2076, 2120, 2128, 2772, 2780, 3341, 3369, 3522, 3523, 3524, 3661, 3731, 3738, 3777, 3815, 3829, 3839, 3924, 3995, 4639

### src/ui/folder-scan-modal.ts (4 occurrences)

Lines: 100, 132, 142, 152

### src/ui/gedcom-import-results-modal.ts (1 occurrence)

Line: 28

## Progress

**Completed: 0/167 (0%)**

## Notes

- Largest concentration in control-center.ts (108 occurrences)
- Can be fixed in batches by file for efficiency
- Be careful to preserve proper nouns (GEDCOM, Canvas, etc.)
