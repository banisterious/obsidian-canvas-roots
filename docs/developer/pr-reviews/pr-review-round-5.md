# PR Review Round 5 Analysis

**Source:** [PR Comment #3613964603](https://github.com/obsidianmd/obsidian-releases/pull/8689#issuecomment-3613964603)
**Date:** 2025-12-04
**Branch:** `pr-fixes-round-5`

## Summary

This review contains **required** fixes across multiple categories plus optional fixes.

| Category | Count | Severity | Status |
|----------|-------|----------|--------|
| Sentence case for UI text | 263+ flagged (~50-80 actual) | Required | ✅ Fixed (mostly false positives) |
| Unexpected `await` of non-Promise | 52 | Required | ✅ Fixed |
| element.style.display usage | 47 | Required | ✅ Fixed |
| innerHTML/outerHTML usage | 19 | Required | ✅ Fixed |
| Undescribed eslint-disable directives | 12 | Required | ✅ Fixed |
| Invalid template literal expression | 6+ | Required | ✅ Fixed |
| Disabling @typescript-eslint/no-explicit-any | 4 | Required | ✅ Fixed |
| Object stringification issues | 20+ | Required | ✅ Fixed |
| Unused eslint-disable directives | 3 | Required | ✅ Fixed |
| Other style property issues | 10+ | Required | ✅ Fixed |
| Unused variables (underscore-prefixed) | 19 | Optional | ✅ Fixed |
| Use FileManager.trashFile() | 2→5 | Optional | ✅ Fixed |

**Important:** Many flagged sentence case issues are **false positives** (proper nouns that should remain capitalized). See the [False Positives Analysis](#false-positives-analysis) section below.

---

## False Positives Analysis

After sampling the flagged lines, a significant portion are **false positives** - proper nouns that are correctly capitalized.

### Categories of False Positives

#### 1. "Canvas Roots:" Prefix Menu Items (~70+ instances)
Mobile context menu items use "Canvas Roots:" prefix:
```typescript
// CORRECT - "Canvas Roots" is a proper noun (plugin name)
.setTitle('Canvas Roots: Regenerate canvas')
.setTitle('Canvas Roots: Show tree statistics')
.setTitle('Canvas Roots: Export as PNG')
```
**Action:** No change needed.

#### 2. Genealogical System Names (~10+ instances)
```typescript
// CORRECT - These are proper noun system names
'Assign Ahnentafel numbers (ancestors)'    // German system
"Assign d'Aboville numbers (descendants)"  // French system
'Assign Henry numbers (descendants)'       // Henry system
```
**Action:** No change needed.

#### 3. Product/Feature Names
```typescript
// CORRECT - Proper nouns
'Welcome to Canvas Roots'
'Open in Family Chart'        // Feature name
'Export to Excalidraw'        // Third-party product
'GEDCOM import'               // Industry standard acronym
```
**Action:** No change needed.

#### 4. Aria Labels (Already Correct)
```typescript
// CORRECT - These are already sentence case
attr: { 'aria-label': 'Zoom out' }
attr: { 'aria-label': 'Search for person' }
attr: { 'aria-label': 'Toggle edit mode' }
```
**Action:** No change needed.

### Exceptions Reference (Keep Capitalized)

| Category | Examples |
|----------|----------|
| **Plugin name** | Canvas Roots |
| **Feature names** | Family Chart, Control Center |
| **Third-party products** | Excalidraw, Obsidian Canvas, Obsidian Bases |
| **Industry standards** | GEDCOM, GEDCOM X |
| **Genealogy software** | Gramps |
| **Numbering systems** | Ahnentafel, d'Aboville, Henry, Modified Register |
| **Acronyms** | UUID, ID, PNG, SVG, CSV, PDF, XML, JSON, CR |

---

## Required Fixes

### 1. Sentence Case for UI Text

**Estimated actual fixes needed:** ~50-80 (after filtering false positives)

**Files affected:**

| File | Flagged | Est. Real Issues |
|------|---------|------------------|
| src/ui/control-center.ts | 126 | ~40-50 |
| main.ts | 92 | ~15-20 |
| src/ui/create-place-modal.ts | 26 | ~5-10 |
| src/ui/family-chart-view.ts | 15 | ~5 |
| src/settings.ts | 14 | ~8 |
| src/ui/create-person-modal.ts | 14 | ~5 |
| src/maps/image-map-manager.ts | 11 | ~5 |
| src/dates/ui/date-systems-card.ts | 9 | ~5 |
| src/ui/create-schema-modal.ts | 9 | ~5 |
| src/ui/place-network-modal.ts | 8 | ~3 |
| src/maps/map-view.ts | 8 | ~3 |
| src/ui/create-map-modal.ts | 8 | ~3 |
| src/organizations/ui/create-organization-modal.ts | 7 | ~3 |
| src/ui/canvas-style-modal.ts | 7 | ~3 |
| src/places/place-note-writer.ts | 6 | ~2 |
| src/ui/migration-diagram-modal.ts | 6 | ~2 |
| src/core/relationship-manager.ts | 5 | ~2 |
| src/ui/reference-numbering.ts | 5 | ~2 |
| src/maps/map-data-service.ts | 5 | ~2 |
| src/core/lineage-tracking.ts | 5 | ~2 |
| src/ui/folder-scan-modal.ts | 4 | ~2 |
| src/organizations/ui/add-membership-modal.ts | 4 | ~2 |
| src/ui/split-wizard-modal.ts | 3 |
| src/ui/add-relationship-modal.ts | 3 |
| src/core/validation-service.ts | 2 |
| src/ui/template-snippets-modal.ts | 2 |
| src/ui/relationship-history-modal.ts | 2 |
| src/organizations/ui/organizations-tab.ts | 2 |
| src/core/merge-service.ts | 2 |
| src/maps/map-controller.ts | 2 |
| src/gramps/gramps-importer.ts | 2 |
| src/gedcomx/gedcomx-importer.ts | 2 |
| src/gedcom/gedcom-importer.ts | 2 |
| src/ui/standardize-places-modal.ts | 1 |
| src/core/relationship-service.ts | 1 |
| src/core/relationship-calculator.ts | 1 |
| src/places/place-graph.ts | 1 |
| src/ui/person-picker.ts | 1 |
| src/organizations/membership-service.ts | 1 |
| src/maps/map-types.ts | 1 |
| src/gramps/gramps-exporter.ts | 1 |
| src/gedcomx/gedcomx-exporter.ts | 1 |
| src/ui/gedcom-import-results-modal.ts | 1 |
| src/gedcom/gedcom-exporter.ts | 1 |
| src/ui/folder-statistics-modal.ts | 1 |
| src/ui/duplicate-detection-modal.ts | 1 |
| src/ui/create-missing-places-modal.ts | 1 |
| src/ui/build-place-hierarchy-modal.ts | 1 |
| src/core/bidirectional-linker.ts | 1 |

**Pattern to fix:**
- WRONG: `'Root Person'`, `'Default Node Width'`, `'Tree Configuration'`
- CORRECT: `'Root person'`, `'Default node width'`, `'Tree configuration'`

**Exceptions (keep capitalized):**
- **Proper nouns:** GEDCOM, Canvas, Obsidian, Excalidraw, Gramps, GEDCOM X
- **Acronyms:** UUID, ID, PNG, SVG, CSV, XML, JSON
- **Technical terms:** Canvas Roots (plugin name), Family Chart (feature name)
- **Format names:** Ahnentafel, d'Aboville, Henry, Modified Register

---

### Line References by File

#### main.ts (92 instances)
L96, L249, L258, L267, L406, L413, L466, L586, L598, L607, L617, L626, L635, L644, L653, L662, L688, L745, L764, L801, L816, L846, L882, L891, L900, L903, L909, L918, L933, L946, L980, L1214, L1317, L1327, L1330, L1336, L1358, L1373, L1388, L1402, L1416, L1425, L1447, L1456, L1477, L1486, L1495, L1504, L1514, L1523, L1532, L1541, L1550, L1559, L1574, L1608, L1617, L1634, L1651, L1666, L1778, L1789, L1804, L1822, L1832, L1844, L1853, L1862, L1871, L1892, L2321, L2402, L2439, L2562, L2710, L2883, L2948, L3014, L3026, L3032-L3037, L3234, L3246-L3251, L3260, L3261, L3262, L3263, L3548, L3719, L3782, L3791-L3796, L4075, L4156

#### src/ui/control-center.ts (126 instances)
L301, L348, L356, L388, L525, L572, L1083, L1109, L1194, L1200, L1321, L1325, L1545, L1549, L1550, L1622, L1685, L1762, L1969, L1977, L2113, L2135, L2448, L2684, L2692, L2874, L2904, L3037, L3038, L3060, L3112, L3325, L3547-L3563, L3690, L3710, L3749, L3763, L3782, L3881, L4491, L4502, L4607, L4730, L4877, L5078, L5094, L5097, L5100, L5524, L5879, L5978, L6044, L6236, L6250-L6255, L6633, L6634, L6668, L6669, L6882, L6941, L6967, L7007, L7045, L7051, L7103, L7127, L7184, L7198, L7225, L7241, L7245, L7256, L7279, L7300, L7310, L7344, L7382, L7388, L7443, L7454, L7572, L7596, L7655, L7682, L7698, L7702, L7713, L7735, L7754, L7756, L7766, L7875, L7913, L7919, L7974, L7985, L8103, L8127, L8186, L8213, L8229, L8233, L8244, L8266, L8287, L8297, L8444, L8526, L8585, L8612, L8628, L8632, L8643, L8666, L8685, L8687, L8789, L9493, L9873, L9891, L9903, L10202, L10218, L10249, L10869, L10921

#### src/settings.ts (14 instances)
L280, L282, L372, L383, L393, L395, L464, L465, L489, L507, L509, L592, L664, L665

#### src/ui/create-place-modal.ts (26 instances)
L397, L431, L464, L474, L502, L504, L514, L524, L548, L556, L565, L577, L584, L590, L604, L617, L625, L626, L637, L644, L659, L665, L683, L733, L781, L782

#### src/ui/create-person-modal.ts (14 instances)
L159, L170, L181, L183, L194, L205, L216, L246, L247, L257, L263, L278, L287, L300

#### src/ui/family-chart-view.ts (15 instances)
L202, L213, L225, L234, L243, L251, L259, L269, L279, L288, L296, L310, L411, L481, L481

#### src/dates/ui/date-systems-card.ts (9 instances)
L46, L80, L123, L398, L414, L426, L441, L462, L541

#### src/ui/create-schema-modal.ts (9 instances)
L181, L201, L220, L344, L464, L550, L551, L592, L602

#### src/maps/map-view.ts (8 instances)
L224, L250, L350, L505, L511, L1073, L1084, L1316

#### src/ui/create-map-modal.ts (8 instances)
L177, L197, L218, L241, L248, L321, L330, L353

#### src/ui/place-network-modal.ts (8 instances)
L618-L619, L624, L632, L641, L642, L654, L666, L678

#### src/organizations/ui/create-organization-modal.ts (7 instances)
L49, L70, L79, L92, L101, L110, L119

#### src/ui/canvas-style-modal.ts (7 instances)
L74, L91, L107, L123, L143, L163, L178

#### src/maps/image-map-manager.ts (11 instances)
L36, L38, L407, L726, L727, L728, L729, L1003, L1003, L1025, L1025

#### src/places/place-note-writer.ts (6 instances)
L413, L413, L434, L434, L436, L436

#### src/ui/migration-diagram-modal.ts (6 instances)
L294-L295, L296-L297, L298-L299, L616, L625, L637

#### src/core/lineage-tracking.ts (5 instances)
L75, L183, L205, L224, L243

#### src/core/relationship-manager.ts (5 instances)
L63, L69, L71, L107, L143

#### src/ui/reference-numbering.ts (5 instances)
L59, L128, L187, L253, L361

#### src/maps/map-data-service.ts (5 instances)
L96, L199, L200, L205, L206

#### src/ui/folder-scan-modal.ts (4 instances)
L100, L132, L142, L152

#### src/organizations/ui/add-membership-modal.ts (4 instances)
L86, L100, L109, L118

#### src/ui/add-relationship-modal.ts (3 instances)
L42, L109, L153

#### src/ui/split-wizard-modal.ts (3 instances)
L159, L936, L1897

#### src/core/validation-service.ts (2 instances)
L396, L495

#### src/ui/template-snippets-modal.ts (2 instances)
L43, L90

#### src/ui/relationship-history-modal.ts (2 instances)
L179, L186

#### src/organizations/ui/organizations-tab.ts (2 instances)
L255, L311

#### src/core/merge-service.ts (2 instances)
L163, L350

#### src/maps/map-controller.ts (2 instances)
L1456, L1456

#### src/gramps/gramps-importer.ts (2 instances)
L144, L161

#### src/gedcomx/gedcomx-importer.ts (2 instances)
L145, L162

#### src/gedcom/gedcom-importer.ts (2 instances)
L146, L163

#### src/ui/standardize-places-modal.ts (1 instance)
L132

#### src/core/relationship-service.ts (1 instance)
L317

#### src/core/relationship-calculator.ts (1 instance)
L62

#### src/places/place-graph.ts (1 instance)
L697

#### src/ui/person-picker.ts (1 instance)
L159

#### src/organizations/membership-service.ts (1 instance)
L392

#### src/maps/map-types.ts (1 instance)
L368

#### src/gramps/gramps-exporter.ts (1 instance)
L187

#### src/gedcomx/gedcomx-exporter.ts (1 instance)
L184

#### src/ui/gedcom-import-results-modal.ts (1 instance)
L35

#### src/gedcom/gedcom-exporter.ts (1 instance)
L192

#### src/ui/folder-statistics-modal.ts (1 instance)
L50

#### src/ui/duplicate-detection-modal.ts (1 instance)
L133

#### src/ui/create-missing-places-modal.ts (1 instance)
L75

#### src/ui/build-place-hierarchy-modal.ts (1 instance)
L148

#### src/core/bidirectional-linker.ts (1 instance)
L613

---

## Required Fix: Unexpected `await` of non-Promise (52 instances)

These are cases where `await` is used on a value that is not a Promise.

**Files affected:**
| File | Lines |
|------|-------|
| main.ts | L846, L903, L980, L1330, L3032-L3037, L3246-L3251, L3791-L3796 |
| src/core/lineage-tracking.ts | L75, L183, L205, L224, L243 |
| src/core/reference-numbering.ts | L59, L128, L187, L253, L361 |
| src/core/relationship-calculator.ts | L62 |
| src/maps/map-data-service.ts | L96 |
| src/maps/map-view.ts | L1073 |
| src/relationships/services/relationship-service.ts | L317 |
| src/ui/control-center.ts | L348, L388, L2113, L2448, L2874, L2904, L3037-L3038, L3060, L3112, L3547-L3563, L3690, L3710, L3749, L3782, L4607, L5078, L6236, L6250-L6255, L7127, L7596, L8127, L8526, L9493, L9891 |
| src/ui/create-map-modal.ts | L241 |
| src/ui/folder-statistics-modal.ts | L50 |
| src/ui/person-picker.ts | L159 |
| src/ui/split-wizard-modal.ts | L159, L1897 |
| src/ui/views/family-chart-view.ts | L411 |

**Fix:** Either remove the `await` keyword or ensure the function returns a Promise.

---

## Required Fix: element.style.display Usage (47 instances)

Obsidian guidelines require using CSS classes instead of directly setting `element.style.display`.

**Files affected:**
| File | Lines |
|------|-------|
| src/maps/map-view.ts | L224 |
| src/ui/control-center.ts | L7045, L7225, L7241, L7245, L7256, L7279, L7382, L7682, L7698, L7702, L7713, L7735, L7913, L8213, L8229, L8233, L8244, L8266, L8444, L8612, L8628, L8632, L8643, L8666 |
| src/ui/create-person-modal.ts | L257, L263, L278 |
| src/ui/create-place-modal.ts | L464, L474, L502, L504, L548, L556, L565, L584, L637, L644, L659 |
| src/ui/migration-diagram-modal.ts | L616, L625, L637 |
| src/ui/place-network-modal.ts | L632, L642, L654, L666, L678 |

**Fix:** Use CSS classes with `.addClass()/.removeClass()` or `.toggleClass()` instead of `element.style.display`.

---

## Required Fix: innerHTML/outerHTML Usage (19 instances)

Do not write to DOM directly using innerHTML/outerHTML property.

**Files affected:**
| File | Lines |
|------|-------|
| src/maps/map-view.ts | L1316 |
| src/ui/migration-diagram-modal.ts | L294-L295, L296-L297, L298-L299 |
| src/ui/place-network-modal.ts | L618-L619, L624, L641 |
| src/ui/template-snippets-modal.ts | L90 |
| src/ui/views/family-chart-view.ts | L202, L213, L225, L234, L243, L251, L259, L269, L279, L288, L296 |

**Fix:** Use DOM methods like `createEl()`, `createSpan()`, `setText()`, `empty()` instead of innerHTML.

---

## Required Fix: Undescribed eslint-disable Directives (12 instances)

Include descriptions to explain why the eslint-disable comment is necessary.

**Files affected:**
| File | Lines |
|------|-------|
| src/maps/image-map-manager.ts | L36, L38, L1003, L1025 |
| src/maps/map-controller.ts | L1456 |
| src/schemas/services/validation-service.ts | L495 |
| src/ui/control-center.ts | L4877, L7198, L7655, L8186, L8585 |
| src/ui/views/family-chart-view.ts | L481 |

**Fix:** Add description comment explaining why the directive is needed:
```typescript
// BAD
// eslint-disable-next-line @typescript-eslint/no-explicit-any

// GOOD
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Third-party library callback type
```

---

## Required Fix: Disabling @typescript-eslint/no-explicit-any (4 instances)

Disabling '@typescript-eslint/no-explicit-any' is not allowed.

**Files affected:**
| File | Lines |
|------|-------|
| src/maps/image-map-manager.ts | L1003, L1025 |
| src/maps/map-controller.ts | L1456 |
| src/ui/views/family-chart-view.ts | L481 |

**Fix:** Replace `any` with proper types like `unknown`, specific interfaces, or generic types.

---

## Required Fix: Unused eslint-disable Directives (3 instances)

Remove eslint-disable directives that are no longer needed (the problem they were suppressing has been fixed).

| # | File | Line | Rule |
|---|------|------|------|
| 1 | (unknown) | - | `no-new-func` |
| 2 | (unknown) | - | `no-constant-condition` |
| 3 | (unknown) | - | `prefer-const` |

**Fix:** Search for and remove these directives.

---

## Required Fix: Object Stringification Issues (20+ instances)

Values that will use Object's default stringification format `[object Object]` when converted to string.

**Files affected:**
| File | Lines | Variable |
|------|-------|----------|
| src/maps/map-data-service.ts | L199, L200, L205, L206 | fm.cr_id, fm.name, fm.place_category, fm.universe |
| src/maps/image-map-manager.ts | L726-L729 | fm.map_id, fm.name, fm.universe, fm.image |
| src/core/place-graph.ts | L697 | dateValue |
| src/core/merge-service.ts | L163, L350 | value |
| src/core/place-note-writer.ts | L413, L434, L436 | value |
| src/organizations/services/membership-service.ts | L392 | value |
| src/ui/control-center.ts | L5094, L5097, L5100 | (template literals) |

**Fix:** Ensure values are properly converted to strings using `String()`, `.toString()`, or are guaranteed to be primitives.

---

## Required Fix: Invalid Template Literal Expression (6+ instances)

Template literal expressions have invalid types (unknown, {}, null).

**Files affected:**
| File | Lines | Issue |
|------|-------|-------|
| main.ts | L3548, L3719 | Invalid type "unknown" |
| src/schemas/services/validation-service.ts | L396 | Invalid type "unknown" |
| src/core/place-note-writer.ts | L413, L434, L436 | Invalid type "{}" |
| src/ui/control-center.ts | L5094, L5097, L5100 | Invalid type "{}" |

**Fix:** Add type guards or explicit type conversions before using in template literals.

---

## Required Fix: Other Style Property Issues (10+ instances)

Other direct style property assignments that should use CSS classes.

| Property | File | Lines |
|----------|------|-------|
| style.position | main.ts | L3260 |
| style.left | main.ts | L3261 |
| style.width | main.ts, control-center.ts | L3262, L5879 |
| style.height | main.ts | L3263 |
| style.fontFamily | (unknown) | - |
| style.cursor | (unknown) | - |
| style.marginLeft | (unknown) | - |
| style.setProperty | (unknown) | - |

**Fix:** Use CSS classes instead of inline styles.

---

## Required Fix: Other Issues

### Creating style elements
- **File:** src/maps/image-map-manager.ts L407
- **Issue:** Creating and attaching "style" elements is not allowed
- **Fix:** Move CSS to `styles.css` file

### Using fetch instead of requestUrl
- **Issue:** Use Obsidian's built-in `requestUrl` function instead of `fetch`
- **Fix:** Replace `fetch()` calls with `requestUrl()`

### Using deprecated substr
- **Issue:** `substr` is deprecated
- **Fix:** Use `substring()` or `slice()` instead

### Unexpected confirm
- **Issue:** Using browser `confirm()` dialog
- **Fix:** Use Obsidian's modal system for confirmations

### Hardcoded .obsidian path
- **Issue:** Obsidian's configuration folder is not necessarily `.obsidian`
- **Fix:** Use `Vault#configDir` to get the current value

### Avoid casting to TFile
- **Issue:** Avoid casting to 'TFile'. Use an 'instanceof TFile' check
- **Fix:** Use type guards instead of type assertions

### Union type issues
- **File:** src/core/bidirectional-linker.ts L613
- **Issue:** 'unknown' overrides all other types in this union type

---

## Optional Fixes

### 1. Unused Variables (19 instances)

Variables prefixed with underscore that are assigned but never used:

| Variable | Location (inferred) |
|----------|---------------------|
| `_InternalCanvasData` | Type definition |
| `_canvasName` | Assignment |
| `_graphService` | Assignment |
| `_name` | Assignment |
| `_stagingPath` | Assignment |
| `_cacheData` | Assignment |
| `_decorator` | Assignment |
| `_minLabel` | Assignment |
| `_maxLabel` | Assignment |
| `_speedLabel` | Assignment |
| `_modeLabel` | Assignment |
| `_branchRootName` | Assignment |
| `_privacyOverrideSetting` | Assignment |
| `_gxBranchRootName` | Assignment |
| `_gxPrivacyOverrideSetting` | Assignment |
| `_grampsBranchRootName` | Assignment |
| `_grampsPrivacyOverrideSetting` | Assignment |
| `_csvBranchRootName` | Assignment |
| `_csvPrivacyOverrideSetting` | Assignment |
| `_FamilyGraphService` | Assignment |
| `_mapIdSetting` | Assignment |
| `_collection` | Assignment |
| `_mainOption` | Assignment |
| `_stagingOption` | Assignment |
| `_yearInfo` | Assignment |
| `_noGroupOption` | Assignment |

**Fix:** Remove the variables if truly unused, or use them as intended.

### 2. Use FileManager.trashFile() (2 instances)

Use `FileManager.trashFile()` instead of `Vault.delete()` or `Vault.trash()` to respect the user's file deletion preference.

**Fix:** Replace `vault.delete()` or `vault.trash()` calls with `app.fileManager.trashFile()`.

---

## Implementation Strategy

### Phase 1: Sentence Case Fixes (Largest batch)
1. Start with control-center.ts (126 instances) - most impactful
2. Then main.ts (92 instances)
3. Then create-place-modal.ts (26 instances)
4. Process remaining files in descending order of count

### Phase 2: Optional Fixes (if desired)
1. Remove unused underscore-prefixed variables
2. Replace Vault.delete()/trash() with FileManager.trashFile()

---

## Testing Checklist

- [ ] Build passes with no TypeScript errors
- [ ] ESLint passes with no errors
- [ ] All UI text displays correctly in sentence case
- [ ] Plugin loads and functions correctly
- [ ] All modals render correctly
- [ ] Settings page displays correctly
- [ ] Control Center tabs display correctly
- [ ] Import/Export dialogs work correctly
- [ ] Map views render correctly
- [ ] Place management works correctly
- [ ] Organization features work correctly

---

## Notes

This is the fifth round of PR review fixes. The primary issue is sentence case consistency across the UI. Many of these may be new strings added in recent features (Places, Organizations, Maps, etc.).

Key areas to watch:
- Control Center has the most fixes (126) due to its comprehensive UI
- main.ts has many menu items and command palette entries
- Modal dialogs throughout the plugin need attention
