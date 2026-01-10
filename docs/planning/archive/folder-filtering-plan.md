# Folder Filtering Implementation Plan

**Status:** ✅ Complete
**Date:** 2025-11-29
**Completed:** 2025-11-29
**Affects:** v0.4.0+ (Folder Filtering feature)

---

## Overview

Implement folder filtering to control which folders Charted Roots scans for person notes. This is the foundation for the staging/import cleanup workflow and supports mixed-use vaults.

**Goals:**
- Exclusion list: Ignore specific folders (templates, archive, non-genealogy)
- Inclusion list: Alternative mode - only scan specified folders
- Settings UI for managing folder lists
- Centralized filter service used by all scanning operations

**Non-Goals (this phase):**
- Staging folder (Phase 2 - Import Cleanup)
- Project-based organization (future)
- Glob pattern support (future enhancement)

---

## Current State Analysis

### How Person Notes Are Discovered Today

**Primary scanner:** `FamilyGraphService.loadPersonCache()` in `src/core/family-graph.ts:653`

```typescript
private loadPersonCache(): void {
    this.personCache.clear();
    const files = this.app.vault.getMarkdownFiles();  // Scans ENTIRE vault

    for (const file of files) {
        const personNode = this.extractPersonNode(file);
        if (personNode) {
            this.personCache.set(personNode.crId, personNode);
        }
    }
}
```

**Key finding:** `peopleFolder` setting is NOT used for filtering - it's only a UI context for imports.

### Integration Points Requiring Changes

| Priority | Component | File | Line | Current Behavior |
|----------|-----------|------|------|------------------|
| **P0** | Person Discovery | `family-graph.ts` | 653 | Scans all markdown files |
| **P1** | Validation | `relationship-validator.ts` | 192 | Scans all files for cr_ids |
| **P1** | Bidirectional Sync | `bidirectional-linker.ts` | 47 | Initializes all person files |
| **P2** | Vault Stats | `vault-stats.ts` | 50 | Scans all files |

**Automatic inheritance:** Duplicate detection, tree generation, and collections use `FamilyGraphService` - fixing P0 fixes these.

---

## Implementation Plan

### Phase 1: Settings & Data Model

**File:** `src/settings.ts`

Add to `CanvasRootsSettings` interface:

```typescript
// Folder filtering
folderFilterMode: 'disabled' | 'exclude' | 'include';
excludedFolders: string[];
includedFolders: string[];
```

Add defaults:

```typescript
folderFilterMode: 'disabled',
excludedFolders: [],
includedFolders: [],
```

**Settings UI additions** (in Data section, after `peopleFolder`):

1. Dropdown: Filter mode (Disabled / Exclude folders / Include folders only)
2. TextArea: Folder list (comma-separated or one per line)
3. Helper text explaining each mode

### Phase 2: FolderFilterService

**New file:** `src/core/folder-filter.ts`

```typescript
import { App, TFile } from 'obsidian';
import { CanvasRootsSettings } from '../settings';

export class FolderFilterService {
    constructor(
        private app: App,
        private settings: CanvasRootsSettings
    ) {}

    /**
     * Check if a file should be included in person note discovery
     */
    shouldIncludeFile(file: TFile): boolean {
        if (this.settings.folderFilterMode === 'disabled') {
            return true;
        }

        const filePath = file.path;

        if (this.settings.folderFilterMode === 'exclude') {
            // Exclude mode: include unless in excluded folder
            for (const folder of this.settings.excludedFolders) {
                if (this.isInFolder(filePath, folder)) {
                    return false;
                }
            }
            return true;
        }

        if (this.settings.folderFilterMode === 'include') {
            // Include mode: exclude unless in included folder
            for (const folder of this.settings.includedFolders) {
                if (this.isInFolder(filePath, folder)) {
                    return true;
                }
            }
            return false;
        }

        return true;
    }

    /**
     * Check if file path is within a folder (including subfolders)
     */
    private isInFolder(filePath: string, folderPath: string): boolean {
        const normalizedFile = filePath.toLowerCase();
        const normalizedFolder = folderPath.toLowerCase().replace(/^\/|\/$/g, '');

        // File is in folder if path starts with folder + /
        return normalizedFile.startsWith(normalizedFolder + '/') ||
               normalizedFile === normalizedFolder;
    }

    /**
     * Get list of active filters for UI display
     */
    getActiveFilters(): { mode: string; folders: string[] } {
        return {
            mode: this.settings.folderFilterMode,
            folders: this.settings.folderFilterMode === 'exclude'
                ? this.settings.excludedFolders
                : this.settings.includedFolders
        };
    }
}
```

### Phase 3: Integrate into FamilyGraphService

**File:** `src/core/family-graph.ts`

1. Add `FolderFilterService` as constructor parameter or create internally
2. Modify `loadPersonCache()`:

```typescript
private loadPersonCache(): void {
    this.personCache.clear();
    const files = this.app.vault.getMarkdownFiles();

    for (const file of files) {
        // NEW: Apply folder filter
        if (!this.folderFilter.shouldIncludeFile(file)) {
            continue;
        }

        const personNode = this.extractPersonNode(file);
        if (personNode) {
            this.personCache.set(personNode.crId, personNode);
        }
    }
}
```

### Phase 4: Integrate into Other Services

**RelationshipValidator** (`src/core/relationship-validator.ts:192`):

```typescript
private getAllPersonCrIds(): Map<string, TFile> {
    const crIdMap = new Map<string, TFile>();
    const files = this.app.vault.getMarkdownFiles();

    for (const file of files) {
        // NEW: Apply folder filter
        if (!this.folderFilter.shouldIncludeFile(file)) {
            continue;
        }

        const cache = this.app.metadataCache.getFileCache(file);
        const crId = cache?.frontmatter?.cr_id;
        if (crId) {
            crIdMap.set(crId, file);
        }
    }

    return crIdMap;
}
```

**BidirectionalLinker** (`src/core/bidirectional-linker.ts:47`):

```typescript
initializeSnapshots(): void {
    const files = this.app.vault.getMarkdownFiles();

    for (const file of files) {
        const cache = this.app.metadataCache.getFileCache(file);
        if (!cache?.frontmatter?.cr_id) {
            continue;
        }

        // NEW: Apply folder filter
        if (!this.folderFilter.shouldIncludeFile(file)) {
            continue;
        }

        this.updateSnapshot(file.path, cache.frontmatter);
    }
}
```

**VaultStatsService** (`src/core/vault-stats.ts:50`):

Similar pattern - add filter check in the file iteration loop.

### Phase 5: Plugin Initialization

**File:** `main.ts`

Create `FolderFilterService` instance during plugin load and pass to services:

```typescript
async onload(): Promise<void> {
    await this.loadSettings();

    // Create folder filter service
    this.folderFilter = new FolderFilterService(this.app, this.settings);

    // Pass to other services...
}
```

---

## Settings UI Design

```
┌─ Data ──────────────────────────────────────────────────┐
│                                                         │
│ People folder         [People           ] [📁]          │
│                                                         │
│ Folder filtering                                        │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Mode              [Disabled           ▼]            │ │
│ │                                                     │ │
│ │ (When set to "Exclude folders" or "Include         │ │
│ │  folders only", specify folders below)             │ │
│ │                                                     │ │
│ │ Folders           [                              ]  │ │
│ │                   [templates                     ]  │ │
│ │                   [archive                       ]  │ │
│ │                   [                              ]  │ │
│ │                                                     │ │
│ │ One folder per line. Subfolders are included.      │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Mode options:**
- **Disabled** - Scan all folders (current behavior)
- **Exclude folders** - Scan everywhere except listed folders
- **Include folders only** - Only scan listed folders

---

## Testing Checklist

### Unit Tests

- [ ] `FolderFilterService.shouldIncludeFile()` with disabled mode
- [ ] `FolderFilterService.shouldIncludeFile()` with exclude mode
- [ ] `FolderFilterService.shouldIncludeFile()` with include mode
- [ ] Path normalization (leading/trailing slashes, case sensitivity)
- [ ] Subfolder inclusion (file in `archive/old` when `archive` is excluded)

### Integration Tests

- [ ] Person discovery respects folder filter
- [ ] Duplicate detection respects folder filter
- [ ] Tree generation only includes filtered people
- [ ] Relationship validation only checks filtered files
- [ ] Bidirectional sync only initializes filtered files

### Manual Testing

- [ ] Create exclusion list, verify excluded files don't appear in tree generation
- [ ] Create inclusion list, verify only included files appear
- [ ] Change filter mode, verify immediate effect on Control Center person list
- [ ] Test with nested folder structures
- [ ] Test with empty filter lists

---

## Migration Notes

**Existing users:** No migration needed. Default is `folderFilterMode: 'disabled'` which preserves current behavior.

**Documentation updates:**
- Update user-guide.md with folder filtering section
- Add to roadmap as implemented

---

## Future Enhancements (Not This Phase)

1. **Staging folder** - Auto-excluded folder for import cleanup workflow
2. **Glob patterns** - Support `**/archive/**` style patterns
3. **Folder picker UI** - Button to browse and select folders
4. **Project mode** - Named projects with independent folder scopes
5. **Per-operation overrides** - Different filters for different operations

---

## Implementation Order

1. [x] Add settings interface and defaults (`settings.ts`)
2. [x] Add settings UI (`settings.ts`)
3. [x] Create `FolderFilterService` (`src/core/folder-filter.ts`)
4. [x] Integrate into `FamilyGraphService` (P0 - biggest impact)
5. [x] Integrate into `RelationshipValidator` (P1)
6. [x] Integrate into `BidirectionalLinker` (P1)
7. [x] Integrate into `VaultStatsService` (P2)
8. [x] Integrate into additional services (ReferenceNumbering, RelationshipCalculator, LineageTracking, DuplicateDetection, CSV/GEDCOM exporters)
9. [x] Update UI components (ControlCenterModal, PersonPickerModal, FolderStatisticsModal, FamilyChartView)
10. [x] Plugin initialization in main.ts with helper methods
11. [ ] Test all integration points
12. [ ] Update documentation

---

## Open Questions (Resolved)

1. **Case sensitivity:** ✅ Implemented case-insensitive matching for cross-platform compatibility

2. **Leading slashes:** ✅ Path normalization implemented - strips leading/trailing slashes

3. **Real-time updates:** Deferred - cache refresh happens on next operation; debounced refresh can be added if needed

4. **UI feedback:** Deferred - can be added in future enhancement

---

## Implementation Notes

### Services Updated
All core services now accept an optional `FolderFilterService` parameter:
- `FamilyGraphService` - via `setFolderFilter()` method
- `RelationshipValidator` - via `setFolderFilter()` method
- `BidirectionalLinker` - via `setFolderFilter()` method
- `VaultStatsService` - via `setFolderFilter()` method
- `ReferenceNumberingService` - via constructor
- `RelationshipCalculator` - via constructor
- `LineageTrackingService` - via constructor
- `DuplicateDetectionService` - via constructor
- `CsvExporter` - via constructor
- `GedcomExporter` - via constructor

### Plugin Helper Methods
```typescript
// Get the global folder filter instance
plugin.getFolderFilter(): FolderFilterService | null

// Create a pre-configured FamilyGraphService
plugin.createFamilyGraphService(): FamilyGraphService
```

### Next Phase
See `import-cleanup-plan.md` for Phase 2: Staging Folder workflow
