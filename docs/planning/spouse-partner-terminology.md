# Plan: Romantic Relationship Label Preference (Issue #167)

- **Status:** Complete
- **Target Version:** v0.19.5
- **GitHub Issue:** [#167](https://github.com/banisterious/obsidian-charted-roots/issues/167)

---

## Overview

Add a preference setting that lets users choose whether the UI displays "Spouse" or "Partner" throughout the plugin. This is a terminology preference only — the underlying data model and property names remain unchanged.

## Motivation

Some users prefer "partner" as a more inclusive term that covers all romantic relationships (marriages, civil unions, long-term partnerships, liaisons) without implying legal marriage. The current UI uses "spouse" consistently, which can feel inappropriate for users documenting non-marriage relationships.

## Feature Toggle

- **Setting name**: "Romantic relationship label"
- **Options**: "Spouse" (default) | "Partner"
- **Location**: Settings → Charted Roots → Sex & gender
- **Scope**: UI labels only; does not affect frontmatter property names

## Affected UI Locations

~37 strings across 14 files need updating:

| File | Count | Examples |
|------|-------|----------|
| `create-person-modal.ts` | 4 | "Spouse", "Spouses", "Add spouse" |
| `family-creation-wizard.ts` | 4 | "Spouse", "Add spouse(s)" |
| `preferences-tab.ts` | 5 | "Spouse arrows", "Spouse edge display" |
| `canvas-style-modal.ts` | 4 | "Spouse arrows", "Spouse edge color" |
| `unified-tree-wizard-modal.ts` | 3 | "Include spouses", "Spouse arrows" |
| `report-generator-modal.ts` | 2 | "Include spouses" |
| `split-wizard-modal.ts` | 4 | "Include spouses" |
| `family-chart-view.ts` | 2 | "Spouses" (relationship labels) |
| `control-center.ts` | 1 | "Spouse links" |
| `merge-wizard-modal.ts` | 1 | "Spouse(s)" |
| `relationship-calculator-modal.ts` | 2 | "Spouse" (description) |
| `tree-statistics-modal.ts` | 1 | "Spouses included" |
| `template-snippets-modal.ts` | 3 | "Spouse" (in Templater suggestions) |
| `export-options-builder.ts` | 1 | "Include spouses in descendants" |

## Implementation

### 1. Add Setting

**File**: `src/settings.ts`

```typescript
// Add to CanvasRootsSettings interface
romanticRelationshipLabel: 'spouse' | 'partner';

// Add to DEFAULT_SETTINGS
romanticRelationshipLabel: 'spouse',
```

### 2. Create Label Helper

**File**: `src/utils/terminology.ts` (new)

```typescript
import type { CanvasRootsSettings } from '../settings';

/**
 * Get the appropriate label for romantic relationships based on user preference.
 * @param settings Plugin settings
 * @param options.plural Return plural form ("Spouses" or "Partners")
 * @param options.lowercase Return lowercase form
 */
export function getSpouseLabel(
    settings: CanvasRootsSettings,
    options?: { plural?: boolean; lowercase?: boolean }
): string {
    const isPartner = settings.romanticRelationshipLabel === 'partner';
    let label: string;

    if (options?.plural) {
        label = isPartner ? 'Partners' : 'Spouses';
    } else {
        label = isPartner ? 'Partner' : 'Spouse';
    }

    return options?.lowercase ? label.toLowerCase() : label;
}

/**
 * Get action label like "Add spouse" or "Add partner"
 */
export function getAddSpouseLabel(settings: CanvasRootsSettings): string {
    return `Add ${getSpouseLabel(settings, { lowercase: true })}`;
}

/**
 * Get compound labels like "Spouse arrows" or "Partner arrows"
 */
export function getSpouseCompoundLabel(
    settings: CanvasRootsSettings,
    suffix: string
): string {
    return `${getSpouseLabel(settings)} ${suffix}`;
}
```

### 3. Add UI Toggle

**File**: `src/settings.ts`

Add dropdown in Sex & gender section:

```typescript
new Setting(sexGenderContent)
    .setName('Romantic relationship label')
    .setDesc('Choose terminology for spouse/partner relationships in the UI')
    .addDropdown(dropdown => dropdown
        .addOption('spouse', 'Spouse')
        .addOption('partner', 'Partner')
        .setValue(this.plugin.settings.romanticRelationshipLabel)
        .onChange(async (value: 'spouse' | 'partner') => {
            this.plugin.settings.romanticRelationshipLabel = value;
            await this.plugin.saveSettings();
        }));
```

### 4. Replace Hardcoded Strings

For each affected file, replace hardcoded strings with helper function calls:

```typescript
// Before
.setName('Spouse')

// After
.setName(getSpouseLabel(this.plugin.settings))
```

```typescript
// Before
text: 'Add spouse'

// After
text: getAddSpouseLabel(this.plugin.settings)
```

```typescript
// Before
.setName('Spouse arrows')

// After
.setName(getSpouseCompoundLabel(this.plugin.settings, 'arrows'))
```

## What Does NOT Change

- Frontmatter property names (`spouse`, `partners`)
- Property alias mappings
- Data model and relationship types
- Export formats (GEDCOM, CSV column headers)
- API/internal variable names

## Testing Checklist

- [x] Setting persists across plugin reloads
- [x] All affected files display correct terminology
- [x] Switching preference updates UI without restart
- [x] Default ("Spouse") matches current behavior exactly
- [x] Both singular and plural forms work correctly
- [x] Compound labels read naturally ("Partner arrows", "Include partners")

## Implementation Notes

The following files were updated:
- `settings.ts` - Setting interface, default value, UI dropdown
- `terminology.ts` - Helper functions (new file)
- `create-person-modal.ts` - Person creation/editing UI
- `family-creation-wizard.ts` - Family wizard labels
- `preferences-tab.ts` - Display preferences
- `canvas-style-modal.ts` - Canvas style overrides
- `unified-tree-wizard-modal.ts` - Tree wizard options
- `split-wizard-modal.ts` - Canvas split options
- `family-chart-view.ts` - Family chart relationship labels
- `control-center.ts` - Statistics display
- `merge-wizard-modal.ts` - Merge preview fields

Files **not** updated (data model, not UI labels):
- `relationship-calculator-modal.ts` - Shows computed relationship types from internal data
- `tree-statistics-modal.ts` - Reads metadata from saved canvases (no settings access)
- `template-snippets-modal.ts` - Template fact_type values (data, not UI)
