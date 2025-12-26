# v0.17.0 Migration Notice

## Overview

Display a one-time workspace leaf when users upgrade to v0.17.0, informing them about the source array migration and providing a direct path to the Cleanup Wizard.

## Trigger Condition

Show the notice when:
1. Plugin loads with version `0.17.x`
2. `plugin.settings.lastSeenVersion` is `< 0.17.0` (or undefined)

After showing, update `lastSeenVersion` to current version.

## Leaf Design

Opens in the right sidebar as a custom view:

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
- **Open Cleanup Wizard**: Opens `CleanupWizardModal`, closes the leaf
- **Dismiss**: Closes the leaf, will show again next session until "Don't show again"
- **Don't show again**: Updates `lastSeenVersion`, closes the leaf permanently

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

## Implementation

### File: `src/ui/views/migration-notice-view.ts`

New view class that:
- Renders the notice content
- Handles button clicks
- Updates settings when dismissed

### File: `src/main.ts`

On plugin load:
```typescript
async onload() {
  // ... existing setup

  // Check for version upgrade
  this.checkVersionUpgrade();
}

private async checkVersionUpgrade(): Promise<void> {
  const currentVersion = this.manifest.version;
  const lastSeen = this.settings.lastSeenVersion;

  // Show notice if upgrading to 0.17.x from earlier version
  if (this.shouldShowMigrationNotice(lastSeen, currentVersion)) {
    this.registerView(
      VIEW_TYPE_MIGRATION_NOTICE,
      (leaf) => new MigrationNoticeView(leaf, this)
    );

    // Open in right sidebar
    const leaf = this.app.workspace.getRightLeaf(false);
    if (leaf) {
      await leaf.setViewState({
        type: VIEW_TYPE_MIGRATION_NOTICE,
        active: true
      });
    }
  }
}

private shouldShowMigrationNotice(lastSeen: string | undefined, current: string): boolean {
  if (!lastSeen) return current.startsWith('0.17');

  // Compare versions: show if lastSeen < 0.17.0 and current >= 0.17.0
  const lastParts = lastSeen.split('.').map(Number);
  if (lastParts[0] === 0 && lastParts[1] < 17 && current.startsWith('0.17')) {
    return true;
  }

  return false;
}
```

## Testing

1. Set `lastSeenVersion` to `0.16.0` in settings
2. Load plugin with version `0.17.0`
3. Verify leaf opens in right sidebar
4. Click "Open Cleanup Wizard" → wizard opens, leaf closes
5. Reload plugin → leaf should reappear (dismissed, not permanently)
6. Click "Don't show again" → `lastSeenVersion` updated
7. Reload plugin → leaf should not appear

## Dependencies

- Post-Import Cleanup Wizard (for the "Open Cleanup Wizard" button)
- Settings system (for `lastSeenVersion` persistence)

## Related

- [Source Array Migration](./source-array-migration.md)
- [Post-Import Cleanup Wizard](./post-import-cleanup-wizard.md)
