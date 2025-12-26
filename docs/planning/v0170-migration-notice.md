# v0.17.0 Migration Notice

## Status: ✅ Complete

Implemented in commit `b4bb817`.

## Overview

Display a one-time workspace tab when users upgrade to v0.17.0, informing them about the source array migration and providing a direct path to the Cleanup Wizard.

## Trigger Condition

Show the notice when:
1. Plugin loads with version `0.17.x`
2. `plugin.settings.lastSeenVersion` is `< 0.17.0` (or undefined)

After showing, update `lastSeenVersion` to current version.

## Leaf Design

Opens as a main workspace tab (not sidebar):

```
┌─────────────────────────────────────────────────────────┐
│  📋 Canvas Roots v0.17.0                              ✕ │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  What's New                                             │
│  ──────────                                             │
│                                                         │
│  Source Property Format Change                          │
│                                                         │
│  The indexed source format (source, source_2,           │
│  source_3...) is now deprecated in favor of a           │
│  YAML array format:                                     │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │ # Old format (deprecated)                       │    │
│  │ source: "[[Census 1900]]"                       │    │
│  │ source_2: "[[Birth Certificate]]"               │    │
│  │                                                 │    │
│  │ # New format                                    │    │
│  │ sources:                                        │    │
│  │   - "[[Census 1900]]"                           │    │
│  │   - "[[Birth Certificate]]"                     │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  Action Required                                        │
│  ───────────────                                        │
│                                                         │
│  If you have notes using the old format, run the        │
│  Cleanup Wizard to migrate them automatically.          │
│                                                         │
│  [Open Cleanup Wizard]                                  │
│                                                         │
│  ─────────────────────────────────────────────────────  │
│  [Dismiss]                        [Don't show again]    │
└─────────────────────────────────────────────────────────┘
```

## Behavior

### On plugin load:
1. Check version condition
2. If triggered, register the view and open it in the right sidebar
3. Leaf has custom icon (e.g., `info` or `sparkles`)

### Button actions:
- **Open Cleanup Wizard**: Opens `CleanupWizardModal`, marks as seen, closes the leaf
- **Dismiss**: Marks as seen, closes the leaf (won't show again)

### View registration:
```typescript
const VIEW_TYPE_MIGRATION_NOTICE = 'canvas-roots-migration-notice';

class MigrationNoticeView extends ItemView {
  getViewType(): string {
    return VIEW_TYPE_MIGRATION_NOTICE;
  }

  getDisplayText(): string {
    return 'Canvas Roots v0.17.0';
  }

  getIcon(): string {
    return 'info';
  }
}
```

## Settings Addition

```typescript
interface CanvasRootsSettings {
  // ... existing settings

  /** Last plugin version the user has seen (for migration notices) */
  lastSeenVersion?: string;
}
```

## Implementation ✅

### Files Created/Modified:
- `src/ui/views/migration-notice-view.ts` - New view class
- `src/settings.ts` - Added `lastSeenVersion` field
- `main.ts` - View registration and version check logic
- `styles/migration-notice.css` - Styling for the notice
- `build-css.js` - Added migration-notice.css to build order

### Key Implementation Details:
- View opens as main workspace tab via `getLeaf('tab')`
- Registers `canvas-roots:open-cleanup-wizard` workspace event for button action
- Version check runs on `workspace.onLayoutReady()`
- Both buttons call `markAsSeen()` before closing

## Testing ✅

1. Edit `manifest.json` to set version to `0.17.0`
2. Clear or set `lastSeenVersion` to earlier version in plugin settings
3. Reload plugin → notice tab opens
4. Click either button → tab closes, `lastSeenVersion` updated
5. Reload plugin → notice does not appear again

## Dependencies

- Post-Import Cleanup Wizard (for the "Open Cleanup Wizard" button)
- Settings system (for `lastSeenVersion` persistence)

## Related

- [Source Array Migration](./source-array-migration.md)
- [Post-Import Cleanup Wizard](./post-import-cleanup-wizard.md)
