# Custom Relationship Types - Implementation Plan

## Overview

This document outlines the implementation plan for Custom Relationship Types in Charted Roots v0.7.0. This feature allows users to define non-familial relationships (mentor, guardian, godparent, liege, etc.) between person notes.

## Goals

1. Define and manage custom relationship types with visual styling
2. Parse `relationships` array from person frontmatter
3. Display relationships in a new Control Center tab
4. Render relationship edges on canvas with custom colors
5. Reorganize Control Center by merging Staging tab into other tabs

## Non-Goals (Future Versions)

- Relationship edges with labels (v0.7.1+)
- Bases views integration (v0.7.1+)
- Toggle visibility by relationship type on canvas (v0.7.1+)
- Auto-creation of inverse relationships in frontmatter

---

## Frontmatter Schema

### Person Note - Relationships Array

```yaml
relationships:
  - type: mentor
    target: "[[Gandalf]]"
    target_id: "person-uuid-123"  # Optional, for reliable resolution
    from: "TA 2941"               # Optional start date
    to: "TA 3019"                 # Optional end date
    notes: "Guided through quest" # Optional description
  - type: godparent
    target: "[[Uncle Bob]]"
    target_id: "person-uuid-456"
```

### Relationship Type Definition (Settings)

```typescript
interface RelationshipTypeDefinition {
  id: string;                              // Unique identifier: 'mentor', 'liege', etc.
  name: string;                            // Display name: 'Mentor', 'Liege Lord'
  category: RelationshipCategory;          // Grouping for UI
  color: string;                           // Edge color (hex)
  lineStyle: 'solid' | 'dashed' | 'dotted';
  inverse?: string;                        // Inverse type id (mentor → disciple)
  symmetric: boolean;                      // true for ally, rival; false for mentor/disciple
  builtIn: boolean;                        // true for defaults, false for user-created
}

type RelationshipCategory =
  | 'legal'        // Guardian, adoptive parent, foster parent
  | 'religious'    // Godparent, mentor, disciple
  | 'professional' // Master, apprentice, employer
  | 'social'       // Witness, neighbor, companion, ally, rival
  | 'feudal'       // Liege, vassal (world-building)
  | 'custom';      // User-defined
```

---

## Built-in Relationship Types

### Legal/Guardianship
| ID | Name | Inverse | Color | Symmetric |
|----|------|---------|-------|-----------|
| `guardian` | Guardian | `ward` | `#14b8a6` (teal) | No |
| `ward` | Ward | `guardian` | `#14b8a6` | No |
| `adoptive_parent` | Adoptive parent | `adopted_child` | `#06b6d4` (cyan) | No |
| `adopted_child` | Adopted child | `adoptive_parent` | `#06b6d4` | No |
| `foster_parent` | Foster parent | `foster_child` | `#0ea5e9` (sky) | No |
| `foster_child` | Foster child | `foster_parent` | `#0ea5e9` | No |

### Religious/Spiritual
| ID | Name | Inverse | Color | Symmetric |
|----|------|---------|-------|-----------|
| `godparent` | Godparent | `godchild` | `#3b82f6` (blue) | No |
| `godchild` | Godchild | `godparent` | `#3b82f6` | No |
| `mentor` | Mentor | `disciple` | `#8b5cf6` (violet) | No |
| `disciple` | Disciple | `mentor` | `#8b5cf6` | No |

### Professional
| ID | Name | Inverse | Color | Symmetric |
|----|------|---------|-------|-----------|
| `master` | Master | `apprentice` | `#f97316` (orange) | No |
| `apprentice` | Apprentice | `master` | `#f97316` | No |
| `employer` | Employer | `employee` | `#ea580c` (dark orange) | No |
| `employee` | Employee | `employer` | `#ea580c` | No |

### Social
| ID | Name | Inverse | Color | Symmetric |
|----|------|---------|-------|-----------|
| `witness` | Witness | - | `#6b7280` (gray) | No |
| `neighbor` | Neighbor | - | `#9ca3af` (light gray) | Yes |
| `companion` | Companion | - | `#22c55e` (green) | Yes |
| `betrothed` | Betrothed | - | `#ec4899` (pink) | Yes |

### Feudal/World-Building
| ID | Name | Inverse | Color | Symmetric |
|----|------|---------|-------|-----------|
| `liege` | Liege lord | `vassal` | `#eab308` (yellow/gold) | No |
| `vassal` | Vassal | `liege` | `#eab308` | No |
| `ally` | Ally | - | `#10b981` (emerald) | Yes |
| `rival` | Rival | - | `#ef4444` (red) | Yes |

---

## Settings Schema

```typescript
interface CanvasRootsSettings {
  // ... existing settings ...

  // Relationship Types
  relationshipTypes: RelationshipTypeDefinition[];
  showBuiltInRelationshipTypes: boolean;  // Toggle to hide built-ins
}
```

Default relationship types will be defined in a constant and merged with user-defined types at runtime.

---

## Implementation Phases

### Phase 1: Types and Settings Infrastructure

**Files to create:**
- `src/relationships/types/relationship-types.ts` - Type definitions
- `src/relationships/constants/default-relationship-types.ts` - Built-in types
- `src/relationships/index.ts` - Barrel export

**Files to modify:**
- `src/settings/settings.ts` - Add relationship type settings
- `src/settings/default-settings.ts` - Add defaults

**Tasks:**
1. Define TypeScript interfaces for relationship types
2. Create default relationship types constant
3. Add settings properties
4. Update settings migration if needed

### Phase 2: Relationship Service

**Files to create:**
- `src/relationships/services/relationship-service.ts` - Core service

**Responsibilities:**
- Parse `relationships` array from person frontmatter
- Resolve relationship targets (wikilink → person note)
- Get all relationships in vault
- Get relationships for a specific person
- Compute inverse relationships (from type definitions)
- Validate relationship data

**Key methods:**
```typescript
class RelationshipService {
  getAllRelationships(): Promise<ParsedRelationship[]>;
  getRelationshipsForPerson(crId: string): Promise<ParsedRelationship[]>;
  getInverseRelationships(crId: string): Promise<ParsedRelationship[]>;
  getRelationshipType(typeId: string): RelationshipTypeDefinition | undefined;
  validateRelationship(rel: RawRelationship): ValidationResult;
}
```

### Phase 3: Control Center - Relationships Tab

**Files to create:**
- `src/ui/control-center/tabs/relationships-tab.ts` - New tab implementation

**Files to modify:**
- `src/ui/control-center.ts` - Add tab registration

**Tab structure:**
1. **Relationship Types card**
   - Gallery of defined types with color swatch and line style preview
   - Add/Edit/Delete buttons
   - Toggle built-in types visibility

2. **Relationship Overview card**
   - Table: Source Person | Type | Target Person | Dates
   - Filter by type, category
   - Click to open person note
   - Show inferred inverse relationships (with indicator)

3. **Statistics card**
   - Total relationships count
   - Breakdown by type
   - Breakdown by category
   - People with most relationships

**Modals to create:**
- `src/ui/modals/relationship-type-modal.ts` - Create/edit relationship types

### Phase 4: Control Center Reorganization

**Merge Staging tab content:**

1. **Import/Export tab additions:**
   - New "Staging" card with:
     - Staging folder stats (files in staging, ready to move)
     - Staged people table (compact version)
     - "Move all to main folder" button
     - "Review staged" button → opens full table modal

2. **Data Quality tab additions:**
   - New "Cleanup tools" card with:
     - Find orphan notes
     - Find duplicate cr_ids
     - Bulk add essential properties
     - Missing cr_id report

**Files to modify:**
- `src/ui/control-center.ts` - Remove Staging tab, add content to other tabs
- `src/ui/control-center/tabs/import-export-tab.ts` - Add staging card
- `src/ui/control-center/tabs/data-quality-tab.ts` - Add cleanup card

### Phase 5: Canvas Edge Rendering

**Files to modify:**
- `src/canvas/canvas-generator.ts` - Add relationship edges
- `src/canvas/types/canvas-types.ts` - Edge type extensions

**Implementation:**
1. After family tree layout is complete, add relationship edges
2. Query RelationshipService for all relationships involving people on canvas
3. Create edges with:
   - Color from relationship type definition
   - Line style (solid/dashed/dotted) - may require CSS or canvas API tricks
   - Straight lines (no routing initially)
4. Edges connect person nodes by cr_id

**Edge styling approach:**
- Obsidian Canvas edges support `color` property
- For line styles, explore:
  - Canvas API edge properties
  - CSS overrides for `.canvas-edge`
  - Custom edge rendering

### Phase 6: Commands and Context Menu

**Commands to add:**
- `open-relationships-tab` - Open Control Center to Relationships tab

**Context menu additions (person notes):**
- "Add relationship..." → Opens modal to add relationship to frontmatter
- "View relationships" → Opens Control Center Relationships tab filtered to person

---

## File Structure

```
src/relationships/
├── index.ts
├── types/
│   └── relationship-types.ts
├── constants/
│   └── default-relationship-types.ts
└── services/
    └── relationship-service.ts

src/ui/
├── control-center/
│   └── tabs/
│       └── relationships-tab.ts
└── modals/
    └── relationship-type-modal.ts
```

---

## UI Mockups

### Relationships Tab Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ Relationships                                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ ┌─ Relationship Types ────────────────────────────────────────┐ │
│ │                                                              │ │
│ │  ● Mentor (violet, solid)     ● Guardian (teal, solid)      │ │
│ │  ● Godparent (blue, solid)    ● Liege (gold, solid)         │ │
│ │  ● Ally (green, dashed)       ● Rival (red, dashed)         │ │
│ │  ...                                                         │ │
│ │                                                              │ │
│ │  [+ Add type]  [☐ Show built-in types]                       │ │
│ └──────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌─ Relationships Overview ────────────────────────────────────┐ │
│ │                                                              │ │
│ │  Filter: [All types ▼]  [All categories ▼]                   │ │
│ │                                                              │ │
│ │  ┌──────────────┬──────────┬──────────────┬────────────────┐ │ │
│ │  │ From         │ Type     │ To           │ Dates          │ │ │
│ │  ├──────────────┼──────────┼──────────────┼────────────────┤ │ │
│ │  │ Frodo        │ mentor → │ Gandalf      │ TA 2941-3019   │ │ │
│ │  │ Gandalf      │ ← disciple │ Frodo      │ (inferred)     │ │ │
│ │  │ Jon Snow     │ ward →   │ Ned Stark    │ 283 AC -       │ │ │
│ │  │ Ned Stark    │ ← guardian │ Jon Snow   │ (inferred)     │ │ │
│ │  └──────────────┴──────────┴──────────────┴────────────────┘ │ │
│ │                                                              │ │
│ │  Showing 4 relationships (2 defined, 2 inferred)             │ │
│ └──────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌─ Statistics ────────────────────────────────────────────────┐ │
│ │                                                              │ │
│ │  Total: 12 relationships across 8 people                    │ │
│ │                                                              │ │
│ │  By Type:           By Category:                             │ │
│ │  • mentor: 3        • religious: 5                           │ │
│ │  • godparent: 2     • legal: 3                               │ │
│ │  • guardian: 2      • social: 2                              │ │
│ │  • ally: 2          • feudal: 2                              │ │
│ │                                                              │ │
│ └──────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Relationship Type Modal

```
┌─────────────────────────────────────────────────────────────────┐
│ Create relationship type                                    [×] │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ID:          [patron________________]                           │
│               Lowercase, no spaces (e.g., 'patron')              │
│                                                                  │
│  Name:        [Patron_________________]                          │
│               Display name                                       │
│                                                                  │
│  Category:    [Professional ▼]                                   │
│                                                                  │
│  Color:       [■ #f97316] [Pick...]                              │
│                                                                  │
│  Line style:  ○ Solid  ○ Dashed  ○ Dotted                        │
│                                                                  │
│  Inverse:     [protege ▼] (optional)                             │
│               The reciprocal relationship type                   │
│                                                                  │
│  ☐ Symmetric  (same relationship in both directions)            │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                      [Cancel]  [Create type]     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Migration Considerations

### Settings Migration

If user has existing settings, new `relationshipTypes` array defaults to empty (built-in types are always available unless hidden).

### Frontmatter Compatibility

The `relationships` array is new - no migration needed. Existing person notes without relationships continue to work.

---

## Testing Checklist

### Unit Tests
- [ ] RelationshipService.getAllRelationships()
- [ ] RelationshipService.getRelationshipsForPerson()
- [ ] RelationshipService.getInverseRelationships()
- [ ] Relationship type CRUD operations
- [ ] Settings serialization/deserialization

### Integration Tests
- [ ] Parse relationships from frontmatter
- [ ] Resolve wikilink targets to person notes
- [ ] Display relationships in Control Center
- [ ] Canvas edge rendering with colors

### Manual Testing
- [ ] Create custom relationship type via modal
- [ ] Add relationship to person via context menu
- [ ] View relationships in Relationships tab
- [ ] Filter relationships by type/category
- [ ] Generate canvas with relationship edges
- [ ] Staging content appears in Import/Export tab
- [ ] Cleanup tools appear in Data Quality tab

---

## Open Questions

1. **Line styles on canvas**: Need to investigate Obsidian Canvas API for dashed/dotted edges. May need to defer to solid-only for v0.7.0.

2. **Edge routing**: Straight lines may cross nodes. Consider basic avoidance in v0.7.1.

3. **Performance**: For vaults with many relationships, consider lazy loading in the overview table.

---

## References

- [Roadmap - Custom Relationship Types](../../wiki-content/Roadmap.md#custom-relationship-types)
- [Frontmatter Reference](../../wiki-content/Frontmatter-Reference.md)
- [Collections Architecture](../developer/architecture/collections.md)
