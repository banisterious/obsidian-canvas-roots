# Value Aliases Implementation Plan

## Overview

Value Aliases extend the existing Property Aliases feature to allow users to map custom **property values** to Canvas Roots' canonical values. This enables users with existing vaults to use custom terminology without editing existing notes.

## Motivation

User feedback:

> "The plugin's Event Types currently are: birth, death, marriage, divorce, residence, occupation, military, immigration, education, anecdote, lore_event. Would we need to use the default options by the plugin for it to work? This could also pose some backwards compatibility problems."
>
> "Worldbuilders have elaborate taxonomies, so the more freedom the better."

The same philosophy that drove Property Aliases ("adapt to the user's vault, not vice versa") applies to enumerated values.

## Scope

### Initial Scope (v0.9.4)

Support value aliases for three field types:

| Field Type | Canonical Values | Example User Values |
|------------|------------------|---------------------|
| **Event type** | `birth`, `death`, `marriage`, `burial`, `residence`, `occupation`, `education`, `military`, `immigration`, `baptism`, `confirmation`, `ordination`, `custom` | `nameday`, `coronation`, `exile`, `knighting` |
| **Gender** | `male`, `female`, `nonbinary`, `unknown` | `masc`, `fem`, `m`, `f`, `nb`, `enby`, `other` |
| **Place category** | `real`, `historical`, `disputed`, `legendary`, `mythological`, `fictional` | `canon`, `fanon`, `alternate`, `apocryphal` |

### Future Scope

- Relationship types (if demand exists)
- Source types
- Organization types

## Design

### Settings Structure

```typescript
interface CanvasRootsSettings {
  // Existing
  propertyAliases: Record<string, string>;  // userProp → canonicalProp

  // New
  valueAliases: {
    eventType: Record<string, string>;      // userValue → canonicalValue
    gender: Record<string, string>;         // userValue → canonicalValue
    placeCategory: Record<string, string>;  // userValue → canonicalValue
  };
}

// Default
valueAliases: {
  eventType: {},
  gender: {},
  placeCategory: {}
}
```

### Value Alias Service

Create `ValueAliasService` alongside existing `PropertyAliasService`:

```typescript
// src/core/value-alias-service.ts

export type ValueAliasField = 'eventType' | 'gender' | 'placeCategory';

export const CANONICAL_EVENT_TYPES = [
  'birth', 'death', 'marriage', 'burial',
  'residence', 'occupation', 'education', 'military',
  'immigration', 'baptism', 'confirmation', 'ordination', 'custom'
] as const;

export const CANONICAL_GENDERS = ['male', 'female', 'nonbinary', 'unknown'] as const;

export const CANONICAL_PLACE_CATEGORIES = [
  'real', 'historical', 'disputed', 'legendary', 'mythological', 'fictional'
] as const;

export class ValueAliasService {
  /**
   * Resolve a user value to its canonical equivalent.
   * Returns canonical value if aliased, original value if valid canonical,
   * or fallback if unknown.
   */
  resolve(field: ValueAliasField, userValue: string): string;

  /**
   * Get the user's preferred value for writing.
   * Returns alias if configured, otherwise canonical value.
   */
  getWriteValue(field: ValueAliasField, canonicalValue: string): string;

  /**
   * Check if a value is valid (either canonical or aliased).
   */
  isValidValue(field: ValueAliasField, value: string): boolean;

  /**
   * Get all configured aliases for a field.
   */
  getAllAliases(field: ValueAliasField): Array<{userValue: string; canonicalValue: string}>;

  /**
   * Set/update an alias.
   */
  setAlias(field: ValueAliasField, userValue: string, canonicalValue: string): Promise<void>;

  /**
   * Remove an alias.
   */
  removeAlias(field: ValueAliasField, userValue: string): Promise<void>;
}
```

### Resolution Logic

#### Reading Values

```typescript
resolve(field: ValueAliasField, userValue: string): string {
  const normalized = userValue.toLowerCase().trim();

  // 1. Check if it's already a canonical value
  const canonicalValues = this.getCanonicalValues(field);
  if (canonicalValues.includes(normalized)) {
    return normalized;
  }

  // 2. Check aliases
  const aliases = this.plugin.settings.valueAliases[field];
  if (aliases[normalized]) {
    return aliases[normalized];
  }

  // 3. Fallback: return 'custom' for events, original value for others
  if (field === 'eventType') {
    return 'custom';  // Graceful degradation
  }
  return userValue;  // Pass through for gender/placeCategory
}
```

#### Writing Values

```typescript
getWriteValue(field: ValueAliasField, canonicalValue: string): string {
  const aliases = this.plugin.settings.valueAliases[field];

  // Find if user has an alias for this canonical value
  for (const [userVal, canonicalVal] of Object.entries(aliases)) {
    if (canonicalVal === canonicalValue) {
      return userVal;
    }
  }
  return canonicalValue;
}
```

### Fallback Behavior

| Field | Unknown Value Behavior |
|-------|------------------------|
| Event type | Resolve to `custom`, preserve in `description` field |
| Gender | Pass through unchanged (handled elsewhere with case normalization) |
| Place category | Pass through unchanged (may cause validation warning) |

**Rationale:**
- Events with unknown types can still be useful via the `custom` type + description
- Gender and place category have existing validation that will catch issues
- No data is lost; users can add aliases later

### Data Quality Integration

When encountering unmapped values, optionally surface them in Data Quality tab:

```
┌─────────────────────────────────────────────────────────────┐
│ Unmapped Values                                        [?]  │
├─────────────────────────────────────────────────────────────┤
│ Found values that could be aliased:                         │
│                                                             │
│ • event_type: "nameday" (12 notes)  [Create alias]          │
│ • event_type: "coronation" (3 notes) [Create alias]         │
│ • gender: "nb" (5 notes)            [Create alias]          │
└─────────────────────────────────────────────────────────────┘
```

This provides a discovery mechanism without blocking functionality.

## UI Design

### Unified Aliases Card

Consolidate property and value aliases into one card with sections:

```
┌─────────────────────────────────────────────────────────────┐
│ # Aliases                                              [?]  │
│ Map your custom names and values to Canvas Roots fields     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ## Property names                                           │
│ ┌─────────────────┬───────────────┬─────────┐               │
│ │ Your property   │ Maps to       │ Actions │               │
│ ├─────────────────┼───────────────┼─────────┤               │
│ │ birthdate       │ born          │ ✎ 🗑   │               │
│ └─────────────────┴───────────────┴─────────┘               │
│                          [+ Add property alias]             │
│                                                             │
│ ## Property values                                          │
│ ┌────────────┬─────────────┬──────────────┬───────┐         │
│ │ Your value │ Maps to     │ Field        │       │         │
│ ├────────────┼─────────────┼──────────────┼───────┤         │
│ │ nameday    │ birth       │ Event type   │ ✎ 🗑 │         │
│ │ masc       │ male        │ Gender       │ ✎ 🗑 │         │
│ │ canon      │ fictional   │ Place cat.   │ ✎ 🗑 │         │
│ └────────────┴─────────────┴──────────────┴───────┘         │
│                             [+ Add value alias]             │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ℹ️ Canonical values take precedence over aliases.       │ │
│ │ Unknown event types are treated as "custom".            │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Value Alias Modal

```
┌─────────────────────────────────────────────────────────────┐
│ Add value alias                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Field type                                                  │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Event type                                          [▼] │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Your value                                                  │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ nameday                                                 │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Maps to                                                     │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ birth                                               [▼] │ │
│ └─────────────────────────────────────────────────────────┘ │
│ (dropdown populated based on field type selection)          │
│                                                             │
│                              [Cancel]  [Add alias]          │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Plan

### Phase 1: Core Infrastructure

1. **Settings schema update** (`src/settings.ts`)
   - Add `valueAliases` to `CanvasRootsSettings` interface
   - Add default empty objects to `DEFAULT_SETTINGS`

2. **Create ValueAliasService** (`src/core/value-alias-service.ts`)
   - Define canonical value constants
   - Implement `resolve()`, `getWriteValue()`, `isValidValue()`
   - Implement `getAllAliases()`, `setAlias()`, `removeAlias()`
   - Add human-readable labels for UI display

3. **Unit tests** for value resolution logic

### Phase 2: Integration Points

1. **Event type resolution** (`src/maps/map-data-service.ts`)
   - Update `parseEventsArray()` to use ValueAliasService
   - Resolve unknown types to `custom` with original in description

2. **Gender resolution** (`src/core/canvas-generator.ts`, `src/ui/tree-preview.ts`, etc.)
   - Update gender color logic to resolve aliases first
   - Update importers to write aliased gender values

3. **Place category resolution** (`src/core/place-graph.ts`, `src/models/place.ts`)
   - Update category parsing to resolve aliases
   - Update place creation to write aliased categories

### Phase 3: Write Integration

1. **Importers** (GEDCOM, GEDCOM X, Gramps, CSV)
   - Use `getWriteValue()` when writing event types, gender, place categories

2. **Note creation modals**
   - Use aliased values when creating/editing notes

### Phase 4: UI Implementation

1. **Rename card** in preferences-tab.ts
   - Change "Property aliases" → "Aliases"
   - Add subtitle explaining both property and value aliases

2. **Add value aliases section**
   - Table showing configured value aliases
   - Edit/delete buttons per row
   - "Add value alias" button

3. **Create ValueAliasModal**
   - Field type dropdown (Event type, Gender, Place category)
   - User value text input
   - Canonical value dropdown (changes based on field type)
   - Validation logic

4. **CSS updates** (`styles.css`, `styles/preferences.css`)
   - Reuse existing alias table styles
   - Add any new classes needed

### Phase 5: Data Quality Integration (Optional)

1. **Unmapped value detection**
   - Scan notes for values that aren't canonical or aliased
   - Track counts per value

2. **Suggestions UI**
   - Display in Data Quality tab
   - Quick "Create alias" button per suggestion

### Phase 6: Documentation

1. **Wiki update** (`wiki-content/Settings-And-Configuration.md`)
   - Document value aliases feature
   - Add table of canonical values per field
   - Update examples

2. **Planning doc** (this document)
   - Mark as complete

## Files to Modify

| File | Changes |
|------|---------|
| `src/settings.ts` | Add `valueAliases` to settings interface and defaults |
| `src/core/value-alias-service.ts` | **New file** - ValueAliasService implementation |
| `src/ui/preferences-tab.ts` | Add value aliases section, create ValueAliasModal |
| `src/maps/map-data-service.ts` | Integrate value alias resolution for event types |
| `src/core/canvas-generator.ts` | Integrate gender alias resolution |
| `src/ui/tree-preview.ts` | Integrate gender alias resolution |
| `src/ui/views/family-chart-view.ts` | Integrate gender alias resolution |
| `src/core/place-graph.ts` | Integrate place category alias resolution |
| `src/gedcom/gedcom-importer.ts` | Use aliased values when writing |
| `src/gramps/gramps-importer.ts` | Use aliased values when writing |
| `src/gedcomx/gedcomx-importer.ts` | Use aliased values when writing |
| `src/csv/csv-importer.ts` | Use aliased values when writing |
| `src/core/data-quality.ts` | Update gender validation to use aliases |
| `styles.css` | Add any new CSS classes |
| `wiki-content/Settings-And-Configuration.md` | Document feature |

## Validation Rules

1. **User value must be provided** (non-empty string)
2. **Canonical value must be selected** (from dropdown)
3. **No duplicate user values** within same field type
4. **No aliasing to same canonical value twice** within same field type (one-to-one mapping)
5. **User value cannot equal a canonical value** (prevents confusion)

## Success Criteria

- [ ] Users can define value aliases for event type, gender, and place category
- [ ] Aliases are resolved when reading frontmatter values
- [ ] Aliased values are written when creating/importing notes
- [ ] Unknown event types gracefully degrade to `custom`
- [ ] UI clearly separates property aliases from value aliases
- [ ] Documentation explains canonical values and aliasing
- [ ] No breaking changes to existing functionality

## Considerations

### Backwards Compatibility

- Existing notes with canonical values continue to work unchanged
- Existing property aliases are unaffected
- Users can add value aliases incrementally without migration

### Performance

- Value resolution is O(1) lookup in alias map after canonical check
- Minimal overhead added to parsing

### Edge Cases

1. **Both aliased and canonical exist**: Canonical takes precedence (same as property aliases)
2. **Case sensitivity**: Normalize to lowercase before comparison
3. **Whitespace**: Trim values before comparison
4. **Multiple aliases → same canonical**: Allowed (many-to-one) but UI should clarify

## Status

**✅ Implementation Complete**

Implemented in v0.9.4:
- Created `ValueAliasService` in `src/core/value-alias-service.ts`
- Added `valueAliases` settings schema to `src/settings.ts`
- UI: Renamed "Property aliases" card to "Aliases" with two sections (property names + property values)
- Created `ValueAliasModal` for adding/editing value aliases
- Integrated value alias resolution for:
  - Event types in `map-data-service.ts`
  - Gender in `family-graph.ts`
  - Place categories in `place-graph.ts`
- Updated wiki documentation in `Settings-And-Configuration.md`
