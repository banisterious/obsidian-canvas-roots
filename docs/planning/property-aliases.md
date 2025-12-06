# Property Aliases Planning Document

## Overview

Property Aliases allow users to map custom frontmatter property names to Canvas Roots' expected fields. This enables compatibility with existing vaults, other plugins, and personal naming preferences without requiring users to rename their existing properties.

## Motivation

A community member requested the ability to use custom property names:

> "Can I use 'birthdate' instead of 'born'? My vault already has hundreds of notes with 'birthdate'."

Currently, Canvas Roots requires specific property names (`born`, `died`, `father`, `mother`, etc.). Users with established vaults or those using other plugins with different conventions face a difficult choice:
1. Rename all existing properties (potentially breaking other workflows)
2. Maintain duplicate properties (error-prone and tedious)
3. Not use Canvas Roots

Property Aliases solves this by allowing users to define mappings like `birthdate → born` without changing their actual frontmatter.

## Scope

### v0.9.3 Scope

- **Person notes only** - This is the primary use case and covers the community request
- Other note types (sources, places, organizations) may be added in future releases if there's demand

### Future Scope

- Source note aliases
- Place note aliases
- Organization note aliases

## Design

### Alias Configuration

Aliases are configured in plugin settings, stored as a mapping object:

```typescript
interface PropertyAliases {
  // Maps user's property name → Canvas Roots internal name
  [userProperty: string]: string;
}

// Example settings
{
  propertyAliases: {
    "birthdate": "born",
    "deathdate": "died",
    "father_name": "father",
    "mother_name": "mother",
    "spouse_name": "spouse",
    "birthplace": "birth_place"
  }
}
```

### Supported Properties

Full support for all person note properties:

#### Core Identity
| Canvas Roots Property | Common Alternatives |
|-----------------------|---------------------|
| `name` | full_name, display_name |
| `cr_id` | id, person_id, uuid |
| `gender` | sex |
| `nickname` | alias, known_as |
| `maiden_name` | birth_name, née |

#### Dates
| Canvas Roots Property | Common Alternatives |
|-----------------------|---------------------|
| `born` | birthdate, birth_date, dob, date_of_birth |
| `died` | deathdate, death_date, dod, date_of_death |

#### Places
| Canvas Roots Property | Common Alternatives |
|-----------------------|---------------------|
| `birth_place` | birthplace, place_of_birth, born_in |
| `death_place` | deathplace, place_of_death, died_in |

#### Relationships
| Canvas Roots Property | Common Alternatives |
|-----------------------|---------------------|
| `father` | father_name, dad, père |
| `father_id` | father_cr_id |
| `mother` | mother_name, mom, mère |
| `mother_id` | mother_cr_id |
| `spouse` | spouse_name, partner, husband, wife |
| `spouse_id` | spouse_cr_id |
| `child` | children, kids |
| `children_id` | child_cr_id |

#### Other
| Canvas Roots Property | Common Alternatives |
|-----------------------|---------------------|
| `occupation` | job, profession, career |
| `universe` | world, setting |
| `image` | photo, portrait, image_path |
| `sourced_facts` | sources, citations |
| `relationships` | custom_relationships |

### Resolution Logic

#### Reading Properties

When reading a person note:

1. Check for Canvas Roots' canonical property name first
2. If not found, check configured aliases
3. First matching alias wins (order not guaranteed)
4. If both canonical and alias exist, canonical takes precedence

```typescript
function resolveProperty(frontmatter: any, property: string, aliases: PropertyAliases): any {
  // Canonical property takes precedence
  if (frontmatter[property] !== undefined) {
    return frontmatter[property];
  }

  // Check aliases
  for (const [userProp, canonicalProp] of Object.entries(aliases)) {
    if (canonicalProp === property && frontmatter[userProp] !== undefined) {
      return frontmatter[userProp];
    }
  }

  return undefined;
}
```

#### Writing Properties

When writing to a person note (imports, modals, etc.):

1. Check if canonical property has a configured alias
2. If alias exists, write to the aliased property name
3. If no alias, write to canonical property name

```typescript
function getWriteProperty(canonical: string, aliases: PropertyAliases): string {
  // Find if user has an alias for this canonical property
  for (const [userProp, canonicalProp] of Object.entries(aliases)) {
    if (canonicalProp === canonical) {
      return userProp;
    }
  }
  return canonical;
}
```

### Essential Properties Integration

When aliases are configured, all UI that displays or inserts property names must use the aliased names:

1. **Essential Properties card** - Display aliased property names instead of canonical
2. **Right-click "Insert essential properties"** - Insert aliased property names
3. **Templates** - Generate with aliased property names
4. **Bases templates** - Use aliased property names in generated templates

This ensures a consistent experience where users see their preferred property names throughout the plugin.

### UI Design

#### Settings Location

Add "Property aliases" card to Preferences tab in Control Center.

#### Settings UI

```
┌─────────────────────────────────────────────────────────────────┐
│ Property aliases                                           [?]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Map your custom property names to Canvas Roots fields.         │
│ Your frontmatter stays unchanged - Canvas Roots reads your     │
│ property names and treats them as the mapped field.            │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Your property      │ Maps to           │ Actions            │ │
│ ├─────────────────────────────────────────────────────────────┤ │
│ │ birthdate          │ born              │ [✎] [🗑]           │ │
│ │ deathdate          │ died              │ [✎] [🗑]           │ │
│ │ father_name        │ father            │ [✎] [🗑]           │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ [+ Add alias]                                                   │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ℹ️ Tip: If both your alias and the Canvas Roots property    │ │
│ │ exist in a note, the Canvas Roots property takes precedence │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Add Alias Modal

```
┌─────────────────────────────────────────────────┐
│ Add property alias                              │
├─────────────────────────────────────────────────┤
│                                                 │
│ Your property name                              │
│ ┌─────────────────────────────────────────────┐ │
│ │ birthdate                                   │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ Maps to Canvas Roots property                   │
│ ┌─────────────────────────────────────────────┐ │
│ │ born                                    [▼] │ │
│ └─────────────────────────────────────────────┘ │
│ (dropdown with all supported properties)        │
│                                                 │
│                    [Cancel]  [Add alias]        │
└─────────────────────────────────────────────────┘
```

## Implementation Plan

### Phase 1: Core Infrastructure

1. Add `propertyAliases` to plugin settings schema
2. Create `PropertyAliasService` with:
   - `resolve(frontmatter, property)` - read value using alias
   - `getWriteProperty(canonical)` - get property name for writing
   - `getDisplayProperty(canonical)` - get property name for UI display
3. Add settings UI to Preferences tab (card + modal)

### Phase 2: Read Integration

Update property reading to use alias resolution:
- `PersonService.getPersonData()` - central integration point
- Events tab statistics
- Any direct frontmatter reads for person properties

### Phase 3: Write Integration

Update property writing to use aliased names:
- Import (GEDCOM, GEDCOM X, Gramps, CSV)
- Person creation modals
- Relationship editing
- Bidirectional linker

### Phase 4: UI Integration

Update UI to display aliased property names:
- Essential Properties card
- Right-click "Insert essential properties" command
- Bases template generation
- Schema validation messages
- Data Quality reports

## Considerations

### Conflicts

If a note has both the canonical property AND an aliased property:
- Canonical wins (consistent, predictable behavior)
- Optionally: Data Quality warning about redundant properties

### Performance

- Alias resolution adds minimal overhead (simple object lookup)
- Cache resolved aliases per note if performance becomes an issue

### Migration

Users with existing aliased vaults don't need to change anything - just configure aliases once and Canvas Roots works with their existing data.

## Related Documentation

- [Frontmatter Reference](https://github.com/banisterious/obsidian-canvas-roots/wiki/Frontmatter-Reference) - Canonical property names
- [Getting Started](https://github.com/banisterious/obsidian-canvas-roots/wiki/Getting-Started) - Initial setup

## Status

**✅ Complete in v0.9.3**

## Success Criteria

- [x] Users can define custom property aliases in settings
- [x] All Canvas Roots features work correctly with aliased properties
- [x] Canonical properties take precedence over aliases
- [x] No changes required to user's existing frontmatter
- [x] Import writes to aliased property names
- [x] Essential Properties displays and inserts aliased names
- [x] Bases templates generated with aliased property names
- [x] Clear documentation of supported aliases

## Implementation Notes

### Bases Template Generation

The People base template is dynamically generated using `generatePeopleBaseTemplate()` which accepts property aliases. When creating a new base file, the template uses aliased property names throughout:

- `visibleProperties` references (e.g., `note.birthdate` instead of `note.born`)
- Filter expressions (e.g., `note.birthdate` in views)
- Formula references (e.g., `if(birthdate && deathdate, ...)`)
- Order and summary columns

**Important:** Existing Bases files are not automatically updated when aliases change. Users must delete and recreate the base file to apply new alias configurations. A warning is displayed in the Preferences tab about this behavior.
