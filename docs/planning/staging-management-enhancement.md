# Staging Management Enhancement

Planning document for adding staging management functionality to Import/Export wizards.

- **Status:** Complete
- **GitHub Issue:** [#137](https://github.com/banisterious/obsidian-canvas-roots/issues/137)
- **Created:** 2025-12-28
- **Updated:** 2026-01-04

---

## Overview

The Import/Export wizards currently allow importing to staging folders, but there is no UI for managing staged imports after creation. This document captures the staging management functionality that existed in the deprecated Control Center Import/Export tab, to be reimplemented in a dedicated Staging Management modal or integrated into the Import Wizard.

### Background

Staging is a workflow for reviewing imported genealogical data before promoting it to the main family tree:

1. **Import to Staging** - Import GEDCOM/Gramps/CSV files into a staging subfolder
2. **Review** - Check for duplicates against existing entities in the main tree
3. **Resolve** - Mark duplicates as "same entity" (skip) or "different entity" (promote)
4. **Promote** - Move reviewed files to the main folder
5. **Cleanup** - Delete rejected staging data

**Supported Entity Types:** Staging handles all Canvas Roots entity types imported from external sources: people, places, sources, events, organizations. The UI displays entity counts and allows filtering by `cr_type`.

---

## Functionality to Implement

### 1. Staging Area Overview

Display staging folder status with statistics:

- **Staging folder path** (from `settings.stagingFolder`)
- **Total entities** in staging (with breakdown by `cr_type`)
- **Subfolder count** (each import creates a subfolder by default)
- **Per-subfolder stats**: name, entity count by type, modified date

**Subfolder Naming Convention:** Import Wizard creates subfolders using the pattern `{source-type}-{YYYY-MM-DD}` (e.g., `gedcom-2025-01-04`, `gramps-2025-01-04`).

**Empty State:** When staging folder is empty, display: "No staged imports. Use the Import Wizard to import data to staging, or configure Web Clipper to save clips here." Include a button to open Import Wizard.

**UI Pattern from deprecated tab:**
```
Staging folder: Family/People/Staging
├── import-2024-01 (45 people) - Modified: Jan 15, 2024
│   [Check duplicates] [Promote] [Delete]
├── grandma-tree (23 people) - Modified: Jan 20, 2024
│   [Check duplicates] [Promote] [Delete]
└── Bulk actions
    [Check all] [Promote all] [Delete all]
```

### 2. Cross-Import Duplicate Detection

Compare staging files against the main tree to find potential duplicates.

**Service:** `CrossImportDetectionService`

**Features:**
- Match by name (fuzzy matching)
- Match by cr_id (exact)
- Match by birth date + name combination
- Returns `CrossImportMatch[]` with confidence scores

**UI Flow:**
1. Click "Check duplicates" on subfolder or "Check all"
2. `CrossImportDetectionService.findCrossImportMatches(subfolderPath?)` returns matches
3. If no matches: `Notice('No duplicates found. All staging data appears unique.')`
4. If matches found: Open `CrossImportReviewModal`

### 3. Duplicate Review Modal

**Existing Modal:** `CrossImportReviewModal`

Shows matched pairs side-by-side:
- Staging person details
- Main tree person details
- Confidence score
- Resolution options: "Same Person" (skip on promote) or "Different Person" (promote)

**Resolution Storage:**
- `CrossImportDetectionService.getResolutions()` returns array of `{ stagingCrId, resolution: 'same' | 'different' }`
- Resolutions are stored **in-memory only** for the current session
- If user closes the modal without promoting, resolutions are discarded (user re-reviews next time)
- Resolutions are checked during promote to skip "same entity" entries

### 4. Promote Operations

Move staging files to the main folder.

**Service:** `StagingService`

**Methods:**
- `promoteAll(options?)` - Promote all staging files
- `promoteSubfolder(path, options?)` - Promote specific subfolder

**Options:**
```typescript
interface PromoteOptions {
  shouldSkip?: (file: TFile, crId: string | undefined) => boolean;
}
```

**Duplicate Skip Logic:**
```typescript
const shouldSkip = crossImportService
  ? (_file: TFile, crId: string | undefined) => {
      if (!crId) return false;
      const resolutions = crossImportService.getResolutions();
      return resolutions.some(r => r.stagingCrId === crId && r.resolution === 'same');
    }
  : undefined;

const result = await stagingService.promoteAll({ shouldSkip });
```

**Result:**
```typescript
interface PromoteResult {
  success: boolean;
  filesPromoted: number;
  filesSkipped: number;  // Due to duplicate resolution
  filesRenamed: number;  // Due to filename conflicts
  errors: string[];
}
```

**Filename Conflict Handling:** If a file with the same name already exists in the destination folder, append a numeric suffix following Obsidian's convention: `John Smith.md` → `John Smith 1.md`. Report renamed files in the result notice.

**UI Flow:**
1. Click "Promote" or "Promote all"
2. Confirmation dialog: "This will move X entities from staging to your main folder. Files marked as 'same entity' will be skipped. Continue?"
3. Execute promote with shouldSkip callback
4. Notice: "Promoted X entities to main tree (Y skipped as duplicates, Z renamed to avoid conflicts)"
5. Refresh staging UI

### 5. Delete Operations

Permanently remove staging data.

**Service:** `StagingService`

**Methods:**
- `deleteAllStaging()` - Delete all staging files
- `deleteSubfolder(path)` - Delete specific subfolder

**UI Flow:**
1. Click delete icon or "Delete all"
2. Confirmation dialog: "This will permanently delete X people from staging. This cannot be undone. Continue?"
3. Execute delete
4. Notice: "Deleted X files from staging"
5. Refresh staging UI

**Result:**
```typescript
interface DeleteResult {
  success: boolean;
  filesDeleted: number;
  error?: string;
}
```

### 6. Confirmation Dialog

All destructive operations use confirmation dialogs.

**Existing utility:** `ConfirmationModal`

```typescript
private confirmAction(title: string, message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const modal = new ConfirmationModal(this.app, title, message, resolve);
    modal.open();
  });
}
```

---

## Services & Dependencies

### StagingService (`src/core/staging-service.ts`)

**Key Methods:**
- `getStagingStats()` - Returns `{ totalPeople, subfolderCount }`
- `getStagingSubfolders()` - Returns `StagingSubfolderInfo[]`
- `getStagingPersonFiles()` - Returns `TFile[]` of person notes in staging root
- `promoteAll(options?)` - Move files to main tree
- `promoteSubfolder(path, options?)` - Move subfolder files
- `deleteAllStaging()` - Remove all staging files
- `deleteSubfolder(path)` - Remove specific subfolder

### CrossImportDetectionService (`src/core/cross-import-detection.ts`)

**Key Methods:**
- `findCrossImportMatches(subfolderPath?)` - Find duplicates
- `getResolutions()` - Get user resolutions for duplicates
- `setResolution(stagingCrId, resolution)` - Store resolution

### FolderFilterService (`src/core/folder-filter-service.ts`)

Used to filter person files by folder location.

### CrossImportReviewModal (`src/ui/cross-import-review-modal.ts`)

Modal for reviewing and resolving duplicate matches.

---

## Implementation Options

### Option A: Dedicated Staging Management Modal

Create a new `StagingManagementModal` accessible from:
- Import Wizard "Manage Staging" button (post-import action)
- Control Center Dashboard tile
- Command palette: "Canvas Roots: Manage staging area"

**Pros:**
- Focused UI for staging operations
- Doesn't clutter Import Wizard
- Can be opened any time to manage existing staging data

**Cons:**
- Another modal to maintain
- User needs to know about it

### Option B: Integrate into Import Wizard

Add a "Review Staging" step/section to the Import Wizard when importing to staging.

**Pros:**
- Natural workflow continuation
- User doesn't leave the wizard context

**Cons:**
- Wizard becomes more complex
- Can't access staging management without opening Import Wizard

### Option C: Control Center Tab (Simplified)

Add a "Staging" tab to Control Center with staging management UI.

**Pros:**
- Centralized location
- Already has card-based layout

**Cons:**
- Import/Export already has its own hub modal
- May confuse the tool organization

### Recommendation

**Option A (Dedicated Modal)** is recommended:
1. Keep Import Wizard focused on importing
2. Allow staging management independent of import operations
3. Entry point from Import Wizard success screen: "View in Staging Manager"
4. Entry point from Dashboard or command palette for returning users

---

## UI/CSS Classes from Deprecated Tab

The following CSS classes were used in the deprecated tab and should be reused or adapted:

```css
.crc-staging-info          /* Staging folder path display */
.crc-staging-list          /* Container for subfolder items */
.crc-staging-item          /* Individual subfolder row */
.crc-staging-item__header  /* Subfolder header with icon */
.crc-staging-item__icon    /* Folder icon */
.crc-staging-item__info    /* Name and stats */
.crc-staging-item__stats   /* Person count, modified date */
.crc-staging-item__actions /* Action buttons */
.crc-staging-actions       /* Bulk actions section */
.crc-staging-actions-header /* "Bulk actions" heading */
```

---

## Implementation Checklist

### Phase 1: Staging Management Modal

- [x] Create `src/ui/staging-management-modal.ts`
- [x] Implement staging overview with stats
- [x] Render subfolder list with per-folder actions
- [x] Integrate CrossImportDetectionService for duplicate checks
- [x] Implement promote operations with shouldSkip logic
- [x] Implement delete operations with confirmation
- [x] Add CSS styles (`styles/staging-manager.css`)

### Phase 2: Entry Points

- [x] Add command: "Canvas Roots: Manage staging area"
- [x] Add "Manage Staging" button to Import Wizard success screen
- [x] Add "Staging" section to Dashboard (when staging has data)
- [x] Add "Staging" entry to TOOL_CONFIGS

### Phase 3: Integration

- [x] Connect Import Wizard "Import to Staging" → show "Manage Staging" button on success screen
- [x] Add badge/indicator on Dashboard when staging has data (yellow staging section)
- [x] Refresh staging stats after import/promote/delete operations (modal re-renders)

---

## Future Considerations

### Web Clipper Integration ([#128](https://github.com/banisterious/obsidian-canvas-roots/issues/128))

Phase 2 of Web Clipper Integration depends on this feature. The Staging Manager should support:
- Filtering by `clip_source_type` frontmatter to show only clipped notes
- Badge/indicator showing count of unreviewed clipped notes
- See [Web Clipper Integration Planning](web-clipper-integration.md) for details

---

## Related Documents

- [Web Clipper Integration Planning](web-clipper-integration.md)
- [Import Wizard](../../wiki-content/Data-Entry.md#import-wizard)
- [Data Entry](../../wiki-content/Data-Entry.md)
- Deprecated tab code: Control Center `showImportExportTab()` (removed in v0.18.x)

---

## Notes

This document was created during cleanup of the deprecated Import/Export tab in Control Center. The tab was replaced by Import/Export wizards, but staging management functionality was not migrated. This plan captures the original implementation for future enhancement.
