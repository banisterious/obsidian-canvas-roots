# Import Cleanup Implementation Plan

**Status:** Phase 1 Complete
**Date:** 2025-11-30
**Affects:** v0.4.0+ (Import Cleanup feature)
**Prerequisites:** Folder Filtering (✅ Complete)

---

## Overview

Tools for consolidating multiple GEDCOM files, cleaning up messy imports, and improving data quality. This builds on the folder filtering foundation to provide a staging workflow for safely processing imports before merging into the main tree.

**Goals (Phase 1 - Staging Workflow):**
- Dedicated staging folder setting with auto-exclusion
- Import destination toggle (main vs staging) in Control Center
- Clear separation between staging data and production tree
- "Promote to main" workflow for cleaned data

**Future Phases (not this document):**
- Phase 2: Cross-import duplicate detection
- Phase 3: Merge & consolidation tools
- Phase 4: Data quality tools

---

## Current State Analysis

### Import Flow Today

**GEDCOM Import:** `src/gedcom/gedcom-importer.ts`
- Import destination is `peopleFolder` setting
- No staging concept exists
- All imports immediately become part of the "live" tree

**CSV Import:** `src/csv/csv-importer.ts`
- Similar pattern - imports to `peopleFolder`

### Folder Filtering Integration

The folder filtering system (now complete) provides the mechanism for isolation:
- `FolderFilterService.shouldIncludeFile()` can exclude staging folders
- All core services already integrated with folder filtering
- Need: automatic staging folder exclusion

---

## Implementation Plan

### Phase 1: Staging Folder Settings

**File:** `src/settings.ts`

Add to `CanvasRootsSettings` interface:

```typescript
// Staging folder
stagingFolder: string;
enableStagingIsolation: boolean;
```

Add defaults:

```typescript
stagingFolder: '',
enableStagingIsolation: true,
```

**Settings UI additions** (in Data section, after `peopleFolder`):

1. Text input: Staging folder path with folder picker button
2. Toggle: Enable staging isolation (auto-exclude from normal operations)
3. Helper text explaining staging workflow

### Phase 2: Auto-Exclusion Logic

**File:** `src/core/folder-filter.ts`

Modify `shouldIncludePath()` to check staging folder:

```typescript
shouldIncludePath(filePath: string): boolean {
    // First check staging folder exclusion
    if (this.shouldExcludeAsStaging(filePath)) {
        return false;
    }

    // Then apply normal filter rules
    // ... existing logic
}

private shouldExcludeAsStaging(filePath: string): boolean {
    if (!this.settings.enableStagingIsolation) {
        return false;
    }

    const stagingFolder = this.settings.stagingFolder;
    if (!stagingFolder) {
        return false;
    }

    return this.isInFolder(filePath, stagingFolder);
}
```

### Phase 3: Import Destination Toggle

**File:** `src/ui/control-center.ts` (GEDCOM tab)

Add toggle in Data Entry tab:

```typescript
// Import destination setting
new Setting(tabContent)
    .setName('Import destination')
    .setDesc('Where to create person notes')
    .addDropdown(dropdown => dropdown
        .addOption('main', 'Main tree')
        .addOption('staging', 'Staging folder')
        .setValue('main')
        .onChange(value => {
            this.importDestination = value;
        })
    );

// If staging selected, show subfolder input
if (this.importDestination === 'staging') {
    new Setting(tabContent)
        .setName('Subfolder name')
        .setDesc('Create imports in a subfolder (e.g., import-2024-11)')
        .addText(text => text
            .setPlaceholder('import-' + new Date().toISOString().slice(0, 7))
            .setValue(this.stagingSubfolder)
            .onChange(value => {
                this.stagingSubfolder = value;
            })
        );
}
```

### Phase 4: Update Importers

**File:** `src/gedcom/gedcom-importer.ts`

Modify constructor/import to accept target folder:

```typescript
export class GedcomImporter {
    constructor(
        private app: App,
        private settings: CanvasRootsSettings,
        private targetFolder?: string  // Override destination
    ) {}

    // In import method, use targetFolder if provided
    private getDestinationFolder(): string {
        return this.targetFolder || this.settings.peopleFolder;
    }
}
```

**File:** `src/csv/csv-importer.ts`

Same pattern - add optional target folder parameter.

### Phase 5: Staging Status Indicator

Add visual indicator when viewing staging files:

**File:** `src/ui/control-center.ts`

Show staging status in header/stats:

```typescript
// In Collections tab or header
if (this.isInStagingFolder(currentFile)) {
    containerEl.createEl('div', {
        cls: 'cr-staging-indicator',
        text: '📦 Staging area - not part of main tree'
    });
}
```

### Phase 6: Basic Staging Actions

Add actions for working with staging data:

**New file:** `src/core/staging-service.ts`

```typescript
export class StagingService {
    constructor(
        private app: App,
        private settings: CanvasRootsSettings
    ) {}

    /**
     * Get all files in staging folder
     */
    getStagingFiles(): TFile[] {
        const stagingPath = this.settings.stagingFolder;
        if (!stagingPath) return [];

        return this.app.vault.getMarkdownFiles()
            .filter(f => f.path.toLowerCase().startsWith(stagingPath.toLowerCase() + '/'));
    }

    /**
     * Get staging subfolders (each import batch)
     */
    getStagingSubfolders(): { path: string; count: number; date: string }[] {
        // Implementation
    }

    /**
     * Move file from staging to main tree
     */
    async promoteToMain(file: TFile): Promise<void> {
        const newPath = file.path.replace(
            this.settings.stagingFolder,
            this.settings.peopleFolder
        );
        await this.app.fileManager.renameFile(file, newPath);
    }

    /**
     * Move all files from a staging subfolder to main tree
     */
    async promoteSubfolderToMain(subfolderPath: string): Promise<number> {
        // Implementation
    }

    /**
     * Delete staging subfolder and contents
     */
    async deleteStagingSubfolder(subfolderPath: string): Promise<void> {
        // Implementation
    }
}
```

---

## Settings UI Design

```
┌─ Data ──────────────────────────────────────────────────┐
│                                                         │
│ People folder         [People           ] [📁]          │
│                                                         │
│ Staging folder        [People-Staging   ] [📁]          │
│ ☑ Enable staging isolation                              │
│   (Auto-exclude staging from normal operations)         │
│                                                         │
│ Folder filtering                                        │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Mode              [Disabled           ▼]            │ │
│ │ ...                                                 │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Control Center Data Entry Tab Design

```
┌─ Control Center ─────────────────────────────────────────┐
│ [Tree Output] [Data Entry] [Collections] [Canvas] [Adv]  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ ┌─[Create Person]─[GEDCOM]─[CSV]─┐                       │
│ │                                │                       │
│ │ Import destination:                                    │
│ │ [Main tree (/People/) ▼]                               │
│ │                                                        │
│ │ (When "Staging" selected:)                             │
│ │ Subfolder: [import-2024-11     ]                       │
│ │                                                        │
│ │ [Select GEDCOM file...]                                │
│ │                                                        │
│ └────────────────────────────────────────────────────────┘
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## Implementation Order

1. [x] Add staging settings to interface and defaults (`settings.ts`)
2. [x] Add staging settings UI (`settings.ts`)
3. [x] Update `FolderFilterService` with auto-staging exclusion (`folder-filter.ts`)
4. [x] Add import destination toggle to GEDCOM import UI (`control-center.ts`)
5. [x] Update `GedcomImporter` to accept target folder (already supported via options)
6. [x] Add import destination toggle to CSV import UI (`control-center.ts`)
7. [x] Update `CsvImporter` to accept target folder (already supported via options)
8. [x] Create `StagingService` with basic operations (`staging-service.ts`)
9. [x] Test staging isolation and import workflow
10. [x] Update documentation

---

## Testing Checklist

### Unit Tests

- [ ] `FolderFilterService.shouldIncludePath()` excludes staging folder
- [ ] Staging exclusion disabled when `enableStagingIsolation` is false
- [ ] Staging exclusion disabled when `stagingFolder` is empty
- [ ] Staging exclusion works regardless of folder filter mode

### Integration Tests

- [ ] GEDCOM import creates files in staging when selected
- [ ] CSV import creates files in staging when selected
- [ ] Staging files don't appear in tree generation
- [ ] Staging files don't appear in duplicate detection
- [ ] Staging files don't appear in Control Center person lists
- [ ] Main tree operations unaffected by staging data

### Manual Testing

- [ ] Set up staging folder, import GEDCOM to staging
- [ ] Verify staging files isolated from main operations
- [ ] Change staging folder setting, verify isolation follows
- [ ] Disable staging isolation, verify files now visible
- [ ] Import multiple GEDCOMs to different staging subfolders

---

## Migration Notes

**Existing users:** No migration needed. Defaults have:
- `stagingFolder: ''` (empty = no staging configured)
- `enableStagingIsolation: true` (but inactive without folder)

---

## Phase 2: Cross-Import Duplicate Detection

**Status:** Core Implementation Complete
**Goal:** Detect duplicates between staging and main tree before promoting

### Overview

When importing GEDCOM/CSV data to staging, users need to identify which people already exist in their main tree before promoting. Phase 2 adds:

1. **Cross-import detection** - Compare staging files against main tree only
2. **Staging tab in Control Center** - Dedicated UI for managing staging data
3. **Resolution workflow** - Mark matches as "same person" or "different people"

### Implementation Plan

#### 2.1 Cross-Import Detection Service

**File:** `src/core/cross-import-detection.ts`

Extends duplicate detection to compare staging vs main tree:

```typescript
export interface CrossImportMatch extends DuplicateMatch {
    stagingPerson: PersonNode;  // Always from staging
    mainPerson: PersonNode;     // Always from main tree
    resolution?: 'same' | 'different' | 'pending';
}

export class CrossImportDetectionService {
    constructor(
        private app: App,
        private settings: CanvasRootsSettings,
        private folderFilter: FolderFilterService,
        private stagingService: StagingService
    ) {}

    /**
     * Find matches between staging and main tree
     */
    findCrossImportMatches(options?: DuplicateDetectionOptions): CrossImportMatch[];

    /**
     * Get staging files that have no match in main tree (safe to promote)
     */
    getUnmatchedStagingFiles(): TFile[];

    /**
     * Get staging files with potential matches (need review)
     */
    getMatchedStagingFiles(): TFile[];
}
```

#### 2.2 Staging Tab in Control Center

**File:** `src/ui/control-center.ts`

Add new tab between "Data Entry" and "Collections":

```
┌─ Control Center ─────────────────────────────────────────┐
│ [Tree Output] [Data Entry] [Staging] [Collections] ...   │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ Staging Area                                             │
│ ─────────────────────────────────────────────────────    │
│ 📁 People-Staging/import-2024-11                         │
│    15 people | 3 potential matches | Modified: Nov 29    │
│    [Check for duplicates] [Promote all] [Delete]         │
│                                                          │
│ 📁 People-Staging/smith-gedcom                           │
│    8 people | 1 potential match | Modified: Nov 15       │
│    [Check for duplicates] [Promote all] [Delete]         │
│                                                          │
│ ─────────────────────────────────────────────────────    │
│ Total: 23 people in staging | 4 need review              │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

#### 2.3 Cross-Import Review Modal

**File:** `src/ui/cross-import-review-modal.ts`

Modal for reviewing staging vs main tree matches:

```
┌─ Review Potential Matches ───────────────────────────────┐
│                                                          │
│ Comparing: import-2024-11 (15 people) vs Main Tree       │
│                                                          │
│ ┌─ Match 1 of 3 ─────────────────────────────────────┐   │
│ │ 87% confidence                                      │   │
│ │                                                     │   │
│ │ STAGING                    MAIN TREE               │   │
│ │ ────────────────────────   ────────────────────    │   │
│ │ John Smith                 John H. Smith           │   │
│ │ b. 1845                    b. 1845                 │   │
│ │ d. 1920                    d. 1920                 │   │
│ │ Father: William Smith      Father: William Smith   │   │
│ │ Mother: Mary Jones         Mother: Mary Jones      │   │
│ │                                                     │   │
│ │ [Same Person] [Different People] [Skip]            │   │
│ └─────────────────────────────────────────────────────┘   │
│                                                          │
│ Progress: 0/3 resolved                                   │
│                                                          │
│ [Cancel] [Finish Review]                                 │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Implementation Order

1. [x] Create `CrossImportDetectionService` (`src/core/cross-import-detection.ts`)
2. [x] Add Staging tab to Control Center
3. [x] Display staging subfolders with stats
4. [x] Add "Check for duplicates" action per subfolder
5. [x] Create `CrossImportReviewModal` for reviewing matches
6. [x] Store resolution decisions (same/different)
7. [x] Update promote logic to handle resolved matches
8. [ ] Test cross-import workflow

### Resolution Storage

Store resolution decisions in a plugin data file to persist across sessions:

```typescript
interface ResolutionRecord {
    stagingCrId: string;
    mainCrId: string;
    resolution: 'same' | 'different';
    resolvedAt: string;  // ISO date
}
```

When a staging file is marked as "same person" as a main tree entry:
- Promote action should skip the file (already exists)
- Or offer to merge data from staging into existing record (Phase 3)

When marked as "different people":
- Promote action proceeds normally
- Decision is remembered to avoid re-prompting

---

## Phase 3: Merge & Consolidation Tools

**Status:** Core Implementation Complete
**Goal:** Merge duplicate records with field-level conflict resolution

### Overview

When a staging person is marked as "same person" as someone in the main tree, the user needs a way to merge the data from both records. Phase 3 provides:

1. **MergeService** - Core logic for merging two person records
2. **MergeWizardModal** - UI for field-by-field conflict resolution
3. **Relationship reconciliation** - Update links from both records

### Merge Strategy

For each field, user can choose:
- **Keep main** - Use value from main tree record
- **Keep staging** - Use value from staging record
- **Combine** - For arrays (spouses, children), merge both lists

```
┌─ Merge Wizard ───────────────────────────────────────────┐
│                                                          │
│ Merging: John Smith (staging) → John H. Smith (main)     │
│                                                          │
│ Field          Staging          Main            Choose   │
│ ────────────────────────────────────────────────────────│
│ Name           John Smith       John H. Smith   [Main ▾] │
│ Born           1845             1845-03-15      [Main ▾] │
│ Died           1920             1920-08-22      [Main ▾] │
│ Birth Place    Ohio             Columbus, OH    [Main ▾] │
│ Father         William Smith    Wm. Smith       [Stag ▾] │
│ Spouse         [Mary Jones]     [Mary J. Doe]   [Both ▾] │
│                                                          │
│ After merge:                                             │
│ - Staging file will be deleted                           │
│ - Main file will be updated with merged data             │
│ - Relationships pointing to staging will update          │
│                                                          │
│ [Cancel]                               [Preview] [Merge] │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Implementation Plan

#### 3.1 MergeService

**File:** `src/core/merge-service.ts`

```typescript
export interface MergeFieldChoice {
    field: string;
    choice: 'main' | 'staging' | 'both';
}

export interface MergeResult {
    success: boolean;
    mainFile: TFile;
    stagingFileDeleted: boolean;
    relationshipsUpdated: number;
    error?: string;
}

export class MergeService {
    constructor(private app: App, private settings: CanvasRootsSettings) {}

    /**
     * Get field differences between two person records
     */
    getFieldDifferences(staging: PersonNode, main: PersonNode): FieldDifference[];

    /**
     * Merge staging record into main record
     */
    async merge(
        stagingFile: TFile,
        mainFile: TFile,
        choices: MergeFieldChoice[]
    ): Promise<MergeResult>;

    /**
     * Update all relationships pointing to staging cr_id to point to main cr_id
     */
    async updateRelationships(oldCrId: string, newCrId: string): Promise<number>;
}
```

#### 3.2 MergeWizardModal

**File:** `src/ui/merge-wizard-modal.ts`

- Shows side-by-side field comparison
- Dropdown for each field to choose source
- Preview of final merged result
- Confirmation before executing merge

### Implementation Order

1. [x] Create `MergeService` with field difference detection
2. [x] Implement merge logic with relationship updates
3. [x] Build `MergeWizardModal` with field selection UI
4. [x] Add "Merge" button to CrossImportReviewModal for "same person" matches
5. [x] Add merge option to duplicate detection modal
6. [ ] Test merge workflow end-to-end

---

## Future Phases

### Phase 4: Data Quality Tools
- Data quality report
- Batch operations (normalize names, dates)
- Inconsistency detection

---

## Open Questions

1. **Subfolder naming:** Default to date-based (`import-2024-11`) or source-based (`smith-gedcom`)? (Recommend: date-based default, user can override)

2. **Promote workflow:** Should "promote to main" update relationships automatically? (Recommend: yes, using same bidirectional sync logic)

3. **Staging visibility:** Should there be a dedicated "Staging" tab in Control Center for Phase 1, or add later? (Recommend: add later in Phase 2 when more staging tools exist)

4. **Multiple staging folders:** Support multiple staging folders, or just one? (Recommend: one for simplicity in Phase 1)
