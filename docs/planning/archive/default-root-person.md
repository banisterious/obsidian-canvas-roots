# Default Root Person for Family Chart

Planning document for using marked root persons as defaults when opening Family Chart.

**Status:** Planning
**GitHub Issue:** #TBD
**Created:** 2025-12-18

---

## Overview

Users want to designate a default starting person for Family Chart to reduce cognitive load when opening new charts. Currently, every "Open Family Chart" action prompts for person selection.

---

## Current State

### Existing Infrastructure

- **"Mark as root person"** context menu action exists
- Sets `root_person: true` in person's frontmatter
- Toggle on/off per person (multiple can be marked)
- Used in Bases template for "Marked root persons" filtered view
- Crown icon indicates marked status in menus

### What's Missing

- Family Chart View doesn't check for marked root persons when opening
- No automatic default selection behavior
- Multiple marked persons creates ambiguity

---

## Proposed Enhancement

### Behavior

When opening Family Chart (via command palette or menu):

1. Check vault for persons with `root_person: true`
2. **If exactly one found:** Use that person as default, open chart directly
3. **If multiple found:** Show picker with marked persons at top (highlighted)
4. **If none found:** Show standard person picker (current behavior)

### Implementation

```typescript
// In activateFamilyChartView or related opening logic
async getDefaultRootPerson(): Promise<string | null> {
  const markedRoots = this.app.vault.getMarkdownFiles()
    .filter(file => {
      const cache = this.app.metadataCache.getFileCache(file);
      return cache?.frontmatter?.root_person === true
          && cache?.frontmatter?.cr_id;
    });

  if (markedRoots.length === 1) {
    const cache = this.app.metadataCache.getFileCache(markedRoots[0]);
    return cache?.frontmatter?.cr_id;
  }

  return null; // Multiple or none - use picker
}
```

### UI Changes

1. **Person picker enhancement:** Show marked root persons at top with crown icon
2. **Family Chart toolbar:** "Change root person" already exists
3. **Notice on auto-open:** Brief notice "Opened with default root: [Name]" (optional)

---

## Open Questions

1. **Multiple marked persons:** Currently allowed. Should marking a new person unmark others?
   - Decision: Keep allowing multiple for now (useful for Bases filtering)
   - Revisit based on user feedback

2. **Per-universe defaults:** Should each universe have its own default root?
   - Decision: Defer to future enhancement if requested

3. **Settings override:** Should there be a setting to disable auto-selection?
   - Decision: Probably not needed initially; user can simply not mark anyone

---

## Scope

### In Scope

- Check for marked root person(s) when opening Family Chart
- Auto-open with default if exactly one marked
- Enhance person picker to highlight marked persons
- Update documentation

### Out of Scope (Future)

- Per-universe default roots
- Settings-based default (separate from frontmatter)
- Auto-unmark when marking new root

---

## Implementation Notes

### Files to Modify

- `main.ts` - `activateFamilyChartView()` method
- `src/ui/views/family-chart-view.ts` - Initial state handling
- `src/ui/person-picker.ts` - Highlight marked root persons
- `wiki-content/Family-Chart-View.md` - Documentation

### Testing

- No marked persons: Standard picker behavior (unchanged)
- One marked person: Auto-opens with that person
- Multiple marked: Picker opens with marked persons at top
- Marked person deleted: Graceful fallback to picker

---

## Timeline

Target: Next minor release (straightforward enhancement)

---

## Related Documents

- [Family Chart View](../../wiki-content/Family-Chart-View.md) - Current documentation
- [Context Menus](../../wiki-content/Context-Menus.md) - Mark as root person action
- [Frontmatter Reference](../../wiki-content/Frontmatter-Reference.md) - root_person property
