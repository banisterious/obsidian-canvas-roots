# Statistics Dashboard Reorganization

- **Status:** Complete
- **Target Version:** v0.19.5
- **Created:** 2026-01-10
- **Origin:** User feedback from jeff962 in [Discussion #147](https://github.com/banisterious/obsidian-charted-roots/discussions/147)

## Problem Statement

The Statistics Dashboard currently contains "Visual Trees" and "Generate Reports" wizards mixed in with statistical/analytical content. These are action wizards for generating output, not statistics.

As jeff962 noted:
> Having "Visual Trees" and "Generate Reports" tucked in the middle of the Statistics Dashboard seems out of place.

## Proposed Solution

1. **Rename** the existing "Visual Trees" tab to "Trees & Reports"
2. **Move** the "Generate Reports" wizard from Statistics to the renamed tab
3. **Keep** Visual Trees wizard in its current location (already in tree-generation tab)
4. **Result**: Statistics tab becomes purely analytical; Trees & Reports tab consolidates all output generation

## Changes Required

### Tab Rename

| Current | New |
|---------|-----|
| Visual Trees | Trees & reports |

### Content Moves

| Item | From | To |
|------|------|-----|
| Generate Reports section | Statistics view | Trees & reports tab |
| Visual Trees section | Statistics view | Trees & reports tab (removed from Statistics) |

### Files Modified

- `src/ui/lucide-icons.ts` - Tab name and description updated
- `src/statistics/ui/statistics-view.ts` - Removed Visual Trees and Generate Reports sections
- `src/statistics/constants/statistics-constants.ts` - Removed unused SECTION_IDS
- `src/ui/control-center.ts` - Added Reports card to tree-generation tab

### UI Layout in Trees & Reports Tab

```
Trees & reports
├── Canvas Trees (existing - new tree wizard, recent trees list)
├── Tips
├── Reports (moved from Statistics)
│   └── [Markdown report generation cards]
├── Visual Trees (moved from Statistics)
│   └── [PDF tree export cards - pedigree, descendant, hourglass, fan chart]
└── Canvas Settings (existing - layout and styling)
```

## Benefits

- Statistics tab becomes focused on analytics only
- Output generation actions are consolidated in one place
- Clearer mental model: "Trees & reports" = "generate outputs"
- Addresses user feedback about misplaced actions
