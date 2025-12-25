# Import/Export Hub Implementation

## Overview

Replace the Import/Export tab in Control Center with a modal-based hub that launches step-by-step wizards for importing and exporting genealogical data.

## Current State

- Import/Export tab in Control Center's Data & Structure group
- Separate modals for progress display (`GedcomImportProgressModal`, `ExportProgressModal`)
- Post-import numbering system modal (disconnected from import flow)

## Target State

- Import/Export Hub modal accessible from Tools group
- 7-step Import Wizard with integrated reference numbering
- 6-step Export Wizard with folder-based selection
- Remove Import/Export tab from Data & Structure group

## Mockups

- `mockups/import-export-hub-mockup.html` - Hub modal with two cards
- `mockups/import-wizard-mockup.html` - Import wizard steps
- `mockups/export-wizard-mockup.html` - Export wizard steps

## Scope

### Hub Modal
- Two-card layout (Import, Export)
- Follows Reports Hub / Media Manager pattern
- Opens corresponding wizard on card click

### Import Wizard (7 Steps)
1. **Format** - GEDCOM 5.5.1, GEDCOM X (JSON), Gramps XML/.gpkg, CSV
2. **File** - Drag-and-drop file picker
3. **Options** - Entity types, target folder, conflict handling
4. **Preview** - Entity counts, duplicate warnings
5. **Import** - Progress with real-time log
6. **Numbering** - Optional reference numbering (Ahnentafel, d'Aboville, Henry, Generation)
7. **Complete** - Summary with actions

### Export Wizard (6 Steps)
1. **Format** - GEDCOM 5.5.1, GEDCOM X (JSON), Gramps XML, CSV
2. **Folders** - Preference folders or custom folder pickers
3. **Options** - Privacy controls, inclusions (sources, places, notes, media)
4. **Preview** - Entity counts, privacy summary
5. **Export** - Progress with real-time log
6. **Complete** - Download/save options

### Files to Modify
- `src/ui/lucide-icons.ts` - Add to `TOOL_CONFIGS`, remove from `TAB_CONFIGS`
- Control Center sidebar - Wire up hub modal click handler
- Create new: `src/ui/import-export-hub-modal.ts`
- Create new: `src/ui/import-wizard-modal.ts`
- Create new: `src/ui/export-wizard-modal.ts`

## Implementation Strategy

### Phase 1: Hub Modal
1. Create `ImportExportHubModal` with two-card layout
2. Add "Import/Export" to Tools group in `TOOL_CONFIGS`
3. Wire click handler to open hub modal

### Phase 2: Import Wizard
1. Create `ImportWizardModal` with step navigation
2. Implement format selection and file picker (Steps 1-2)
3. Implement options and preview (Steps 3-4)
4. Connect to existing import logic for progress (Step 5)
5. Integrate `ReferenceNumberingService` for optional numbering (Step 6)
6. Add completion summary (Step 7)

### Phase 3: Export Wizard
1. Create `ExportWizardModal` with step navigation
2. Implement format and folder selection (Steps 1-2)
3. Implement privacy options and preview (Steps 3-4)
4. Connect to export logic for progress (Step 5)
5. Add completion with download (Step 6)

### Phase 4: Cleanup
1. Remove Import/Export tab from `TAB_CONFIGS`
2. Remove corresponding tab content renderer
3. Update documentation

## Considerations

### Gramps Media Support
- `.gpkg` format includes embedded media
- Import wizard should extract and link media files
- Format card description notes this: "Gramps software (.gpkg includes media)"

### Reference Numbering Integration
- Currently a separate modal post-import
- Move into Step 6 of Import Wizard
- Uses existing `ReferenceNumberingService` from `src/core/reference-numbering.ts`
- Root person picker needed for numbering origin

### Folder Selection (Export)
- "Preference folders" uses paths from Preferences settings
- "Specify folders" shows custom folder pickers per entity type
- Matches current Control Center pattern

### Privacy Controls (Export)
- Living person exclusion based on years since birth
- Option to redact vs. fully exclude
- Yellow warning in preview showing count of excluded persons

## Dependencies

- Existing import/export logic (GEDCOM parsing, export generation)
- `ReferenceNumberingService` for numbering integration
- `FamilyGraphService` for person picker in numbering step

## Progress

### Completed
- [x] Phase 1: Hub Modal - `ImportExportHubModal` created and wired to Tools group
- [x] Phase 2: Import Wizard - All 7 steps implemented
  - GEDCOM and Gramps formats fully functional
  - Reference numbering integrated in Step 6
  - .gpkg media extraction working
- [x] Phase 3: Export Wizard - All 6 steps implemented
  - GEDCOM export functional
  - Privacy controls (exclude/redact living persons)
  - Entity inclusion toggles (sources, places, notes)
- [x] Phase 4: Cleanup - Import/Export tab removed from Control Center
- [x] CSS styling refinements for wizard modals
  - Footer overlap fix (footer outside scrollable content)
  - Step 3 vertical spacing optimization
  - Small input field width fix (60px for years input)
  - Content area max-height increased to 65vh

### Remaining
- [ ] GEDCOM X import wizard integration
- [ ] CSV import wizard integration
- [ ] GEDCOM X export format
- [ ] Gramps XML export format
- [ ] CSV export format

## Related

- `src/ui/reports-hub-modal.ts` - Hub modal pattern reference
- `src/ui/media-manager-modal.ts` - Hub modal pattern reference
- `src/core/reference-numbering.ts` - Numbering service to integrate
