# Post-Import Cleanup Wizard

## Overview

A step-by-step wizard that guides users through the recommended post-import cleanup sequence. After importing a messy GEDCOM file, users currently must navigate multiple Control Center tabs and run operations in the correct order. The wizard consolidates this into a single guided experience.

## Release Target

**Target Version:** v0.17.0 (Data Cleanup Bundle)

This wizard is the primary feature of v0.17.0, bundled with Source Array Migration. Both features focus on post-import data quality and benefit from being released together.

See [Roadmap: v0.17.0 Data Cleanup Bundle](../../wiki-content/Roadmap.md#v0170-data-cleanup-bundle) for bundle details.

## Problem Statement

After a GEDCOM import (especially from a file with data quality issues), users face:

- **Scattered tools:** Cleanup operations are spread across Data Quality, Places, and other tabs
- **Unknown order:** No guidance on which operations to run first
- **Manual coordination:** Users must remember to run each step and track what's done
- **No visibility:** No consolidated view of data quality issues across the vault

## Wizard Steps

| Step | Operation | Service | Why This Order |
|------|-----------|---------|----------------|
| 1 | Quality Report | `DataQualityService` | Understand scope of issues before fixing |
| 2 | Fix Bidirectional Relationships | `DataQualityService` | Graph integrity required for other operations |
| 3 | Normalize Date Formats | `DataQualityService` | Standardized dates enable age calculations |
| 4 | Normalize Gender Values | `DataQualityService` | Required for parent role validation |
| 5 | Clear Orphan References | `DataQualityService` | Remove dangling links |
| 6 | Migrate Source Properties | `SourceMigrationService` | Convert indexed sources to array format |
| 7 | Standardize Place Variants | `PlaceGraphService` | Consistent names before geocoding |
| 8 | Bulk Geocode | `GeocodingService` | Coordinates for map features |
| 9 | Enrich Place Hierarchy | `PlaceGraphService` | Build containment chains |
| 10 | Flatten Nested Properties | `DataQualityService` | Optional: fix frontmatter structure |

### Step Dependencies

```
Step 1 (Quality Report)
    └── Informs all subsequent steps (shows issue counts)

Step 2 (Bidirectional Relationships)
    └── Required before Steps 3-6 (graph integrity)

Steps 3-6 (Person/Event normalization)
    └── Can run in any order after Step 2
    └── Step 6 depends on Step 5 conceptually (clean refs first)

Step 7 (Place Variants)
    └── Required before Step 8 (standardize before geocoding)

Step 8 (Bulk Geocode)
    └── Required before Step 9 (coordinates before hierarchy)

Step 9 (Place Hierarchy)
    └── Final place operation

Step 10 (Flatten Properties)
    └── Independent, can run anytime
```

## UI Design

### Overview Screen

Compact 5×2 tile grid showing all 10 steps at a glance:

```
┌─────────────────────────────────────────────────────────────┐
│  Post-Import Cleanup Wizard                              ✕  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐│
│  │ 1       │ │ 2       │ │ 3       │ │ 4       │ │ 5       ││
│  │ Quality │ │ Bidir   │ │ Dates   │ │ Gender  │ │ Orphans ││
│  │ Report  │ │ Rels    │ │         │ │         │ │         ││
│  │         │ │         │ │         │ │         │ │         ││
│  │ 47 items│ │ 12 fixes│ │ 8 fixes │ │ 3 fixes │ │ 0 issues││
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘│
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐│
│  │ 6       │ │ 7       │ │ 8       │ │ 9       │ │ 10      ││
│  │ Sources │ │ Place   │ │ Geocode │ │ Place   │ │ Flatten ││
│  │ Array   │ │ Variants│ │         │ │ Hierarchy│ │ Props   ││
│  │         │ │         │ │         │ │         │ │         ││
│  │ 5 fixes │ │ Pending │ │ Pending │ │ Pending │ │ 2 fixes ││
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘│
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│  [Start Cleanup]                          [Skip All & Exit] │
└─────────────────────────────────────────────────────────────┘
```

**Tile Elements:**
- Step number (top-left corner)
- Short title (2-3 words max)
- Status badge (bottom): issue count, "Done", "Pending", or "0 issues"
- Current step highlighted with accent border
- Completed steps show checkmark overlay

### Step Types

| Type | Steps | Behavior | UI Pattern |
|------|-------|----------|------------|
| Review-only | 1 | Generates report for manual review. No auto-fix. | Issue list with edit links |
| Batch-fix | 2-6, 10 | Detect issues, show preview, apply fixes with one click. | Preview table + Apply button |
| Interactive | 7-9 | Require user decisions per item. | Decision cards with options |

### Step View Layout

#### Review-Only Step (Step 1)

```
┌─────────────────────────────────────────────────────────────┐
│  Step 1: Quality Report                                  ✕  │
├─────────────────────────────────────────────────────────────┤
│  ● ○ ○ ○ ○ ○ ○ ○ ○ ○                          Step 1 of 10 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Review data quality issues identified in your vault.       │
│  Issues are tagged with which step can auto-fix them.       │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ ▼ Death Date Before Birth (3)              [Manual]   │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │   John Smith (1850-1849)                          ↗  │  │
│  │   Mary Jones (1920-1918)                          ↗  │  │
│  │   Robert Brown (1880-1875)                        ↗  │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │ ▼ Invalid Date Format (8)                  [Step 3]   │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │   Alice White - birth_date: "May 5 1900"          ↗  │  │
│  │   ...                                                 │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │ ▼ Missing Bidirectional Link (12)          [Step 2]   │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │   ...                                                 │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│  [← Overview]                                    [Next →]   │
└─────────────────────────────────────────────────────────────┘
```

**Interactions:**
- Click row → Opens Person Edit modal (primary action)
- Click ↗ button → Opens note in new tab (secondary action)
- `[Manual]` tag indicates no auto-fix available
- `[Step N]` tag indicates which step will auto-fix

#### Batch-Fix Step (Steps 2-6, 10)

```
┌─────────────────────────────────────────────────────────────┐
│  Step 3: Normalize Date Formats                          ✕  │
├─────────────────────────────────────────────────────────────┤
│  ● ● ● ○ ○ ○ ○ ○ ○ ○                          Step 3 of 10 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Convert non-standard date formats to ISO 8601 (YYYY-MM-DD).│
│                                                             │
│  8 dates will be normalized:                                │
│                                                             │
│  ┌────────────────┬──────────────────┬───────────────────┐  │
│  │ Person         │ Current          │ Normalized        │  │
│  ├────────────────┼──────────────────┼───────────────────┤  │
│  │ Alice White    │ May 5 1900       │ 1900-05-05        │  │
│  │ Bob Green      │ 12/25/1885       │ 1885-12-25        │  │
│  │ Carol Black    │ 1st Jan 1920     │ 1920-01-01        │  │
│  │ ...            │ ...              │ ...               │  │
│  └────────────────┴──────────────────┴───────────────────┘  │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│  [← Back]           [Skip Step]              [Apply Fixes]  │
└─────────────────────────────────────────────────────────────┘
```

#### Interactive Step (Steps 7-9)

```
┌─────────────────────────────────────────────────────────────┐
│  Step 7: Standardize Place Variants                      ✕  │
├─────────────────────────────────────────────────────────────┤
│  ● ● ● ● ● ● ● ○ ○ ○                          Step 7 of 10 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Choose the canonical name for each place with variants.    │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Variant Group 1 of 5                                  │  │
│  │                                                       │  │
│  │ These 4 variants refer to the same place:             │  │
│  │                                                       │  │
│  │   ○ Dublin, Ireland                    (12 refs)      │  │
│  │   ○ Dublin                             (8 refs)       │  │
│  │   ○ Dublin, County Dublin, Ireland     (3 refs)       │  │
│  │   ○ Dublin City                        (1 ref)        │  │
│  │                                                       │  │
│  │   [Use Selected as Canonical]                         │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│  [← Back]           [Skip Group]              [Next Group]  │
└─────────────────────────────────────────────────────────────┘
```

### Step States

| State | Visual | Description |
|-------|--------|-------------|
| ⏳ Pending | Gray tile, no badge | Not yet analyzed |
| 🔢 Ready | Blue tile, count badge | Issues found, shows count (e.g., "8 fixes") |
| ✅ Complete | Green tile, checkmark | Operation finished successfully |
| ⏭️ Skipped | Gray tile, skip icon | User chose to skip or no issues found |
| 🔄 In Progress | Blue tile, spinner | Currently processing |

### Progress Indicator

Compact horizontal bar on step views:

```
● ● ● ○ ○ ○ ○ ○ ○ ○                          Step 3 of 10
```

- Filled circles (●) for completed steps
- Empty circles (○) for pending steps
- Current step has accent ring
- Connected with thin line (turns green when complete)

### Summary Screen

```
┌─────────────────────────────────────────────────────────────┐
│  Cleanup Complete                                        ✕  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ✓ Your vault has been cleaned up successfully!             │
│                                                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│  │     47      │ │      5      │ │      3      │            │
│  │   Fixes     │ │   Skipped   │ │   Manual    │            │
│  │   Applied   │ │   Steps     │ │   Issues    │            │
│  └─────────────┘ └─────────────┘ └─────────────┘            │
│                                                             │
│  Step Breakdown:                                            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Step 1: Quality Report          ✓ Reviewed            │  │
│  │ Step 2: Bidirectional Rels      ✓ 12 fixed            │  │
│  │ Step 3: Date Formats            ✓ 8 normalized        │  │
│  │ Step 4: Gender Values           ⏭ Skipped (0 issues)   │  │
│  │ Step 5: Orphan References       ✓ 5 cleared           │  │
│  │ Step 6: Source Migration        ✓ 15 migrated         │  │
│  │ Step 7: Place Variants          ✓ 4 standardized      │  │
│  │ Step 8: Bulk Geocode            ⏭ Skipped by user      │  │
│  │ Step 9: Place Hierarchy         ⏭ Skipped (no coords)  │  │
│  │ Step 10: Flatten Properties     ✓ 3 flattened         │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  3 issues require manual attention:                         │
│  • Death date before birth (3 people)                       │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│  [Save Report]                                      [Done]  │
└─────────────────────────────────────────────────────────────┘
```

**Save Report:**
- Creates markdown note: `Canvas Roots/Reports/Cleanup Summary YYYY-MM-DD.md`
- Includes timestamp, summary stats, per-step details
- Provides audit trail for data quality improvements

## Entry Points

| Location | Trigger | Context |
|----------|---------|---------|
| Import Wizard results | "Run Cleanup Wizard" button | After completing GEDCOM import |
| Control Center > Data Quality > Quick Start card | Action button | Manual access from Data Quality tab |
| Command palette | "Canvas Roots: Post-Import Cleanup Wizard" | Keyboard shortcut access |

## Smart Defaults

### Pre-Analysis

Before displaying the overview, the wizard:
1. Runs quick detection for each step's issues
2. Populates tile badges with issue counts
3. Identifies steps that can be auto-skipped

### Auto-Skip Logic

Steps are auto-skipped when:
- **0 issues detected** → Show "0 issues" badge, gray out tile
- **Prerequisite not met** → Show "Waiting for Step N" message
- **Service unavailable** → Show "Service not configured" (e.g., geocoding without API key)

Users can override auto-skip for any step.

### State Persistence

Wizard state saved in `plugin.settings.cleanupWizardState`:

```typescript
interface CleanupWizardState {
  /** Vault path this state applies to */
  vaultPath: string;
  /** Timestamp of last wizard session */
  lastRun: number;
  /** Current step (1-10) or 0 if not started */
  currentStep: number;
  /** Per-step completion status */
  steps: {
    [stepNumber: number]: {
      status: 'pending' | 'in_progress' | 'complete' | 'skipped';
      issueCount: number;
      fixCount: number;
      skippedReason?: string;
    };
  };
  /** Whether to show resume prompt on next open */
  hasUnfinishedSession: boolean;
}
```

## Technical Implementation

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CleanupWizardModal                       │
│  (Orchestrates wizard flow, manages state, renders UI)      │
└──────────────────────────┬──────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│ DataQuality   │  │ SourceMigra- │  │ PlaceGraph    │
│ Service       │  │ tionService  │  │ Service       │
│ (Steps 1-5,10)│  │ (Step 6)     │  │ (Steps 7,9)   │
└───────────────┘  └───────────────┘  └───────────────┘
                                              │
                                              ▼
                                      ┌───────────────┐
                                      │ Geocoding     │
                                      │ Service       │
                                      │ (Step 8)      │
                                      └───────────────┘
```

### File Structure

```
src/
├── ui/
│   └── modals/
│       └── cleanup-wizard/
│           ├── CleanupWizardModal.ts      # Main modal class
│           ├── WizardOverview.ts          # Overview tile grid
│           ├── WizardStep.ts              # Base step component
│           ├── steps/
│           │   ├── QualityReportStep.ts   # Step 1
│           │   ├── BidirectionalStep.ts   # Step 2
│           │   ├── DateNormalizeStep.ts   # Step 3
│           │   ├── GenderNormalizeStep.ts # Step 4
│           │   ├── OrphanClearStep.ts     # Step 5
│           │   ├── SourceMigrateStep.ts   # Step 6
│           │   ├── PlaceVariantStep.ts    # Step 7
│           │   ├── GeocodeStep.ts         # Step 8
│           │   ├── PlaceHierarchyStep.ts  # Step 9
│           │   └── FlattenPropsStep.ts    # Step 10
│           └── WizardSummary.ts           # Summary screen
└── styles/
    └── cleanup-wizard.css                 # Wizard-specific styles
```

### Step Interface

```typescript
interface WizardStepConfig {
  id: string;
  number: number;
  title: string;
  shortTitle: string;  // For tile display (2-3 words)
  description: string;
  type: 'review' | 'batch' | 'interactive';
  service: string;
  detectMethod: string;
  previewMethod?: string;
  applyMethod?: string;
  dependencies: number[];  // Step numbers this depends on
}

const WIZARD_STEPS: WizardStepConfig[] = [
  {
    id: 'quality-report',
    number: 1,
    title: 'Quality Report',
    shortTitle: 'Quality Report',
    description: 'Review data quality issues identified in your vault.',
    type: 'review',
    service: 'DataQualityService',
    detectMethod: 'analyzeQuality',
    dependencies: []
  },
  {
    id: 'bidirectional',
    number: 2,
    title: 'Fix Bidirectional Relationships',
    shortTitle: 'Bidir Rels',
    description: 'Ensure parent-child relationships are properly linked in both directions.',
    type: 'batch',
    service: 'DataQualityService',
    detectMethod: 'detectMissingBidirectional',
    previewMethod: 'previewBidirectionalFixes',
    applyMethod: 'fixBidirectionalRelationships',
    dependencies: [1]
  },
  // ... remaining steps
];
```

### Service Method Mapping

| Step | Service | Detect | Preview | Apply |
|------|---------|--------|---------|-------|
| 1 | `DataQualityService` | `analyzeQuality()` | N/A | N/A |
| 2 | `DataQualityService` | `detectMissingBidirectional()` | `previewBidirectionalFixes()` | `fixBidirectionalRelationships()` |
| 3 | `DataQualityService` | `detectNonStandardDates()` | `previewDateNormalization()` | `normalizeDates()` |
| 4 | `DataQualityService` | `detectNonStandardGender()` | `previewGenderNormalization()` | `normalizeGender()` |
| 5 | `DataQualityService` | `detectOrphanReferences()` | `previewOrphanClearing()` | `clearOrphanReferences()` |
| 6 | `SourceMigrationService` | `detectIndexedSources()` | `previewMigration()` | `migrateToArrayFormat()` |
| 7 | `PlaceGraphService` | `detectPlaceVariants()` | N/A (interactive) | `standardizeVariant()` |
| 8 | `GeocodingService` | `detectUngeocoded()` | N/A (interactive) | `geocodePlace()` |
| 9 | `PlaceGraphService` | `detectMissingHierarchy()` | N/A (interactive) | `enrichHierarchy()` |
| 10 | `DataQualityService` | `detectNestedProperties()` | `previewFlattening()` | `flattenProperties()` |

## Phased Implementation

### Phase 1: Core Wizard (MVP)

**Goal:** Working wizard with basic step navigation and existing operations.

**Tasks:**
1. Create `CleanupWizardModal` with step navigation
2. Implement overview tile grid
3. Wire up existing service methods for each step
4. Add basic progress indicator
5. Create entry points (Import Results, Data Quality tab, command)
6. Basic summary screen

**Scope:** Steps 1-5, 10 (person/event cleanup only, no place operations)

### Phase 2: Place Operations

**Goal:** Add interactive place steps.

**Tasks:**
1. Implement Step 7 (Place Variants) interactive UI
2. Implement Step 8 (Bulk Geocode) with progress
3. Implement Step 9 (Place Hierarchy) interactive UI
4. Add dependency checking between place steps

### Phase 3: Smart Analysis

**Goal:** Pre-scan vault and enable auto-skip.

**Tasks:**
1. Implement pre-analysis on wizard open
2. Populate tile badges with issue counts
3. Auto-skip logic for zero-issue steps
4. Add state persistence across sessions
5. Resume interrupted cleanup prompt

### Phase 4: Polish & Customization

**Goal:** User experience refinements.

**Tasks:**
1. User-configurable step order (drag-drop tiles)
2. Save/load cleanup profiles
3. Keyboard navigation (arrow keys, Enter, Escape)
4. Animations for step transitions
5. Integration with schema validation (if implemented)

## Testing Strategy

### Unit Tests

- Step detection methods return correct counts
- Preview methods generate accurate before/after data
- Apply methods modify frontmatter correctly
- State persistence saves/loads correctly

### Integration Tests

- Full wizard flow from start to summary
- Auto-skip behavior when no issues
- Resume interrupted session
- Error handling when service fails

### Manual Testing Checklist

- [ ] Import GEDCOM with known quality issues
- [ ] Open wizard from Import Results modal
- [ ] Verify tile badges show correct counts
- [ ] Complete each step type (review, batch, interactive)
- [ ] Skip a step and verify state
- [ ] Close and reopen wizard (resume prompt)
- [ ] Complete wizard and save report
- [ ] Verify report content matches actual changes

## Mockup Reference

An interactive HTML mockup is available for design reference:

**Location:** `mockups/cleanup-wizard-mockup.html`

The mockup includes:
- Overview tile grid layout
- All 10 step views
- Summary screen
- Design notes documenting UX decisions

## Related Documentation

- [Source Array Migration](./source-array-migration.md) - Step 6 implementation details
- [Roadmap: v0.17.0 Data Cleanup Bundle](../../wiki-content/Roadmap.md#v0170-data-cleanup-bundle) - Release context
- [Data Quality Wiki](../../wiki-content/Data-Quality.md) - Current manual workflow

## Implementation Status

### Completed Steps

| Step | Status | Notes |
|------|--------|-------|
| 1 | ✅ Complete | Quality Report with collapsible categories, clickable rows |
| 2 | ✅ Complete | Bidirectional relationship fixes with preview |
| 3 | ✅ Complete | Date normalization, reads raw frontmatter, updates `born`/`died` fields |
| 4 | ✅ Complete | Gender normalization, reads raw frontmatter, detects non-canonical values |
| 5 | ✅ Complete | Orphan reference clearing with preview |
| 6 | ⏳ Pending | Source array migration (service exists, wizard integration TBD) |
| 7 | ✅ Complete | Place variant standardization with interactive table, select all/deselect, canonical override |
| 8 | ⏳ Pending | Bulk geocoding (interactive step) |
| 9 | ⏳ Pending | Place hierarchy enrichment (interactive step) |
| 10 | ✅ Complete | Nested property flattening with preview |

### Key Implementation Details

**Detection reads raw frontmatter:** Steps 3 and 4 now read directly from `app.metadataCache.getFileCache(file).frontmatter` instead of the PersonNode cache, ensuring:
- Detection reflects actual on-disk values
- Already-fixed issues aren't flagged as problems
- The PersonNode cache's normalization (e.g., `female`→`F`) doesn't hide issues

**Canonical gender values:** M, F, X, U (GEDCOM standard)

**Date fields:** Writes to `born`/`died` (not `birth_date`/`death_date`)

**Clickable rows:** Steps 1, 3, 4, 5, 10 have clickable preview rows that open person notes

**Step 7 Place Variants:** Interactive table with:
- Select all/deselect all checkbox
- Per-variant checkbox selection
- Canonical value dropdown (with "keep as-is" option)
- Reference count column
- Strikethrough styling for selected variants
- Uses existing `findPlaceNameVariants()` from `standardize-place-variants-modal.ts`

### Bug Fixes Applied

- Gender detection now reads raw `sex` frontmatter value (not normalized cache)
- Date detection now reads raw `born`/`died` frontmatter values
- Date normalization writes to `born`/`died` fields (was writing to wrong field names)
- Consolidated frontmatter cache access in `checkDataFormat()` to avoid redundant calls

## Open Questions

1. **Step reordering:** Should users be able to reorder steps, or is the fixed order essential for data integrity?
2. **Partial re-runs:** After completing the wizard, can users run individual steps again without starting over?
3. **Undo support:** Should fixes be reversible? (Complex due to frontmatter modifications)
4. **Keyboard shortcuts:** What key bindings for step navigation (Tab, Arrow keys, numbers)?
