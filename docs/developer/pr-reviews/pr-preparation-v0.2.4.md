# PR Preparation for v0.2.4

**Date:** 2025-11-25
**Branch:** `fix/pr-review-preparation`
**Base:** `main` (v0.2.3-beta)

---

## Overview

This document tracks issues identified through analysis of Obsidian plugin PR review patterns, based on the Sonigraph plugin's 11 rounds of PR reviews. The goal is to proactively address these issues before submitting Canvas Roots for community plugin review.

---

## Issue Summary

| Priority | Category | Count | Status |
|----------|----------|-------|--------|
| HIGH | require() imports | 4 | ✅ Complete |
| MEDIUM | Inline styles | 57→31 | ✅ Partial (dynamic styles remain) |
| MEDIUM | Explicit `any` types | 16 | Pending |
| LOW | Untyped catch errors | 36 | Pending |
| LOW | Debug console.log statements | 30+ | Pending |

**Total Issues:** ~143

---

## Category 1: require() Imports ✅ COMPLETE

**Priority:** HIGH
**Status:** ✅ Fixed in commit (Phase 1)

### Original Issue

Obsidian reviewers flag `require()` style imports. The following were found:

| # | File | Line | Code |
|---|------|------|------|
| 1 | src/ui/control-center.ts | 3911 | `const { remote } = require('electron');` |
| 2 | src/ui/control-center.ts | 4025 | `const { remote } = require('electron');` |
| 3 | src/ui/control-center.ts | 4046 | `require('path').join(...)` |
| 4 | src/ui/control-center.ts | 4049 | `const fs = require('fs');` |

### Resolution

Refactored log export functionality to use Obsidian's vault API instead of Node.js/Electron:

1. **Changed log export location** from external file system to vault-relative folder
   - Default folder: `.canvas-roots/logs`
   - Configurable via settings text input

2. **Replaced Electron directory picker** with simple text input for vault path
   - Removed `require('electron').remote.dialog.showOpenDialog()`
   - UI now shows editable text field for folder path

3. **Replaced Node.js file system calls** with Obsidian vault adapter
   - `require('fs').writeFileSync()` → `app.vault.adapter.write()`
   - `require('path').join()` → template string concatenation
   - Added automatic folder creation via `app.vault.createFolder()`

4. **Updated default settings**
   - `logExportPath: ''` → `logExportPath: '.canvas-roots/logs'`

**Benefits:**
- Works on mobile (no Node.js/Electron dependency)
- Logs stored within vault (portable, backed up)
- Simpler UI (no native dialog)
- Follows Obsidian plugin best practices

---

## Category 2: Inline Styles ✅ PARTIAL

**Priority:** MEDIUM
**Status:** ✅ Reduced from 57 to 31 (remaining are dynamic/necessary)

### Original Issue

Reviewers prefer CSS classes over direct style manipulation (`element.style.property = value`).

### Resolution

Created CSS utility classes in `styles/modals.css`:

```css
/* Icon color utilities */
.cr-icon--success { color: var(--color-green); }
.cr-icon--warning { color: var(--color-orange); }
.cr-icon--error { color: var(--color-red); }
.cr-icon--muted { opacity: 0.3; }

/* Text color utilities */
.cr-text--success { color: var(--color-green); }
.cr-text--error { color: var(--color-red); }

/* Info box styling */
.cr-info-box { margin-bottom: 1em; padding: 0.75em; background: var(--background-secondary); border-radius: 4px; }

/* Card title without top margin */
.cr-card-title--no-margin { margin-top: 0; }

/* Lucide icon container styling */
.cr-lucide-icon { display: inline-flex; align-items: center; justify-content: center; }
```

**Files updated:**
- `src/settings.ts` - Info boxes now use `.cr-info-box` class
- `src/ui/validation-results-modal.ts` - Icons use `.cr-icon--*` classes
- `src/ui/gedcom-import-results-modal.ts` - Icons use `.cr-icon--*` classes
- `src/ui/find-on-canvas-modal.ts` - Empty state icon uses `.cr-icon--muted`
- `src/ui/folder-scan-modal.ts` - Icons use `.cr-icon--*` classes
- `src/ui/lucide-icons.ts` - Uses `.cr-lucide-icon` for flex display
- `src/ui/control-center.ts` - Titles use `.cr-card-title--no-margin`

### Remaining Inline Styles (31 - necessary)

These must remain as inline styles due to dynamic/calculated values:
- **Progress bars** - Width is percentage-based (`${percent}%`)
- **Tooltip positioning** - Position based on mouse coordinates
- **Icon sizing** - Dynamic size parameter
- **Display toggles** - Interactive visibility changes
- **Cursor states** - Changes during drag interactions

---

## Category 3: Explicit `any` Types

**Priority:** MEDIUM
**Issue:** Reviewers flag `any` types. Should use proper TypeScript interfaces.

### Occurrences

| # | File | Line | Pattern | Suggested Fix |
|---|------|------|---------|---------------|
| 1 | src/settings.ts | 248 | `(this.plugin as any)` | Add method to plugin interface |
| 2 | src/settings.ts | 262 | `(this.plugin as any)` | Add method to plugin interface |
| 3 | src/core/family-graph.ts | 784 | `value: any` | `value: unknown` |
| 4 | src/core/family-graph.ts | 805 | `fm: any` | Define frontmatter interface |
| 5 | src/core/vault-stats.ts | 167 | `spouse: any` | Define spouse type |
| 6 | src/core/canvas-finder.ts | 32 | `node: any` | Define canvas node interface |
| 7 | src/core/canvas-finder.ts | 44 | `node: any` | Define canvas node interface |
| 8 | src/core/bidirectional-linker.ts | 181 | `frontmatter: any` | Define frontmatter interface |
| 9 | src/core/bidirectional-linker.ts | 229 | `frontmatter: any` | Define frontmatter interface |
| 10 | src/core/bidirectional-linker.ts | 241 | `snapshot as any` | Proper type assertion |
| 11 | src/ui/control-center.ts | 609 | `(this.plugin as any)` | Add method to plugin interface |
| 12 | src/ui/control-center.ts | 1684 | `(this.app as any)` | Use proper App interface |
| 13 | src/ui/tree-statistics-modal.ts | 59 | `node: any` | Define canvas node interface |
| 14 | src/ui/tree-statistics-modal.ts | 117 | `node: any` | Define canvas node interface |
| 15 | src/ui/tree-statistics-modal.ts | 127 | `node: any` | Define canvas node interface |

### Fix Strategy

1. **Create shared interfaces:**
   ```typescript
   // src/types/canvas.ts
   interface CanvasNode {
     type: 'file' | 'text' | 'link' | 'group';
     file?: string;
     x: number;
     y: number;
     width: number;
     height: number;
   }

   // src/types/frontmatter.ts
   interface PersonFrontmatter {
     cr_id?: string;
     name?: string;
     father?: string;
     mother?: string;
     spouse?: string | string[];
     // ...
   }
   ```

2. **Extend plugin interface for internal methods**

3. **Use `unknown` instead of `any` where type is truly unknown**

---

## Category 4: Untyped Catch Errors

**Priority:** LOW
**Issue:** `catch (error)` without type annotation treats error as `any`.

### Count by File

| File | Count |
|------|-------|
| src/ui/control-center.ts | 15 |
| src/gedcom/gedcom-importer.ts | 3 |
| src/core/bidirectional-linker.ts | 1 |
| src/core/canvas-finder.ts | 2 |
| src/core/vault-stats.ts | 1 |
| src/gedcom/gedcom-parser.ts | 1 |
| src/gedcom/gedcom-exporter.ts | 1 |
| src/excalidraw/excalidraw-exporter.ts | 2 |
| src/ui/find-on-canvas-modal.ts | 1 |
| src/ui/folder-scan-modal.ts | 1 |
| src/ui/person-picker.ts | 2 |
| src/ui/regenerate-options-modal.ts | 1 |
| src/ui/canvas-style-modal.ts | 2 |
| src/ui/tree-statistics-modal.ts | 1 |

**Total:** 36 occurrences

### Fix Strategy

Change all `catch (error)` to `catch (error: unknown)` and use type guards:

```typescript
// Before
catch (error) {
  console.error('Error:', error);
}

// After
catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error('Error:', message);
}
```

---

## Category 5: Debug Console Statements

**Priority:** LOW
**Issue:** Debug `console.log` statements should be removed or gated behind log level.

### Files with Debug Logs

| File | Count | Notes |
|------|-------|-------|
| src/core/family-chart-layout.ts | 15 | Layout debugging |
| src/core/family-graph.ts | 1 | William Anderson debug |
| src/ui/control-center.ts | 1 | William Anderson debug |
| src/core/canvas-finder.ts | 1 | Error logging (keep) |
| src/core/vault-stats.ts | 1 | Error logging (keep) |
| Various files | ~10 | Error logging (keep) |

### Fix Strategy

1. **Remove development debug logs:**
   - `[Canvas Roots DEBUG - ...]` logs
   - `[FamilyChartLayout]` logs

2. **Keep error logs but use logger:**
   - Replace `console.error()` with `this.logger.error()`

3. **Gate remaining debug logs behind log level:**
   - Use existing `LoggerFactory` with appropriate log levels

---

## Implementation Plan

### Phase 1: HIGH Priority (require() imports)
1. Refactor log export to use Obsidian vault adapter
2. Remove electron/fs/path require statements
3. Test log export functionality

### Phase 2: MEDIUM Priority (inline styles)
1. Create CSS utility classes for icon colors
2. Create CSS class for info boxes
3. Replace static inline styles with classes
4. Keep dynamic styles (tooltips, progress bars, visibility)

### Phase 3: MEDIUM Priority (any types)
1. Create shared type definitions file
2. Define CanvasNode interface
3. Define PersonFrontmatter interface
4. Update all occurrences to use proper types

### Phase 4: LOW Priority (catch errors)
1. Add `: unknown` to all catch blocks
2. Add type guards for error handling
3. Use consistent error message extraction

### Phase 5: LOW Priority (debug logs)
1. Remove development debug statements
2. Replace console.error with logger.error
3. Verify log level gating works

---

## Verification Checklist

- [ ] Build passes (`npm run build`)
- [ ] No TypeScript errors
- [ ] No ESLint errors
- [ ] Plugin loads in Obsidian
- [ ] Core functionality works:
  - [ ] Tree generation
  - [ ] GEDCOM import/export
  - [ ] Bidirectional sync
  - [ ] Log export
- [ ] Settings save/load correctly

---

## Reference

This analysis is based on patterns identified in Sonigraph's PR review process:
- 11 rounds of reviews
- 441+ issues identified across categories
- Common patterns that Obsidian reviewers consistently flag

Key learnings applied:
- require() imports are always flagged
- Inline styles should be CSS classes where possible
- `any` types need proper interfaces
- Error handling should use `unknown` type
- Debug logs should be removed or properly gated
