# Schema Validation & Consistency Checks - Implementation Plan

## Overview

User-defined validation schemas to catch data inconsistencies and enforce property rules across person notes. Schemas are stored as markdown notes with `type: schema` frontmatter, following the existing pattern for places and maps.

---

## Design Decisions

### Schema Storage
- **Schema notes** with `type: schema` frontmatter (consistent with `type: place`, `type: map`)
- Stored in configurable folder (default: `Schemas/`)
- Editable in Obsidian's native editor
- JSON schema definition in frontmatter

### Validation Timing
- **On-demand** validation (button click)
- Triggered from:
  - "Validate vault" button in Schemas tab
  - "Run validation" in Data Quality tab
  - Context menu on person notes ("Validate against schemas")

### Tab Placement
New tab order: Status → Guide → Import/Export → Staging → People → Places → Maps → **Schemas** → Collections → Data Quality → Tree Output → Canvas Settings → Advanced

---

## Schema Note Format

Schema notes use flat frontmatter properties (Obsidian best practice) with the schema definition in a JSON code block in the note body.

```yaml
---
type: schema
cr_id: schema-house-stark
name: House Stark Schema
description: Validation rules for House Stark members
applies_to_type: collection
applies_to_value: "House Stark"
---

# House Stark Schema

This schema validates all members of House Stark.

```json schema
{
  "required_properties": ["allegiance", "combat_style"],
  "properties": {
    "race": {
      "type": "enum",
      "values": ["human", "direwolf"],
      "default": "human"
    },
    "magic_type": {
      "type": "enum",
      "values": ["warging", "greensight", "none"],
      "required_if": {
        "property": "has_magic",
        "equals": true
      }
    },
    "allegiance": {
      "type": "wikilink"
    },
    "birth_place": {
      "type": "wikilink",
      "target_type": "place"
    },
    "age_at_death": {
      "type": "number",
      "min": 0,
      "max": 200
    }
  },
  "constraints": [
    {
      "rule": "magic_type !== 'greensight' || race !== 'direwolf'",
      "message": "Direwolves cannot have greensight"
    },
    {
      "rule": "!died || born",
      "message": "Cannot have death date without birth date"
    }
  ]
}
```

### Frontmatter Properties

| Property | Type | Description |
|----------|------|-------------|
| `type` | string | Always `"schema"` |
| `cr_id` | string | Unique identifier |
| `name` | string | Display name |
| `description` | string | Optional description |
| `applies_to_type` | string | One of: `collection`, `folder`, `universe`, `all` |
| `applies_to_value` | string | Value for the applies_to_type (not needed for `all`) |

### Schema Definition (JSON code block)

The schema definition is stored in a fenced code block with language `json schema` (or just `json`). This keeps the frontmatter flat while allowing complex nested schema rules.

### Design Philosophy: UI-First

Users should be able to create and manage schemas entirely through the Control Center UI without ever editing files manually:

- **Create Schema Modal**: Guided form to build schemas step-by-step
- **Edit Schema Modal**: Full editing capabilities for existing schemas
- **No manual JSON editing required**: The modal generates and updates the JSON code block
- **Power user escape hatch**: Advanced users *can* edit the JSON directly if they prefer
- **Import/Export**: JSON export for sharing schemas between vaults

---

## Implementation Phases

### Phase 1: Core Types & Service (~150 lines)

**Files to create:**
- `src/schemas/types/schema-types.ts` - TypeScript interfaces
- `src/schemas/services/schema-service.ts` - Schema loading and management

**Types:**
```typescript
// Frontmatter properties (flat)
interface SchemaNoteFrontmatter {
  type: 'schema';
  cr_id: string;
  name: string;
  description?: string;
  applies_to_type: 'collection' | 'folder' | 'universe' | 'all';
  applies_to_value?: string;  // Not needed when applies_to_type is 'all'
}

// Full schema including parsed JSON definition
interface SchemaNote {
  // From frontmatter
  cr_id: string;
  name: string;
  description?: string;
  appliesToType: 'collection' | 'folder' | 'universe' | 'all';
  appliesToValue?: string;
  filePath: string;

  // From JSON code block in body
  definition: SchemaDefinition;
}

interface SchemaDefinition {
  requiredProperties: string[];
  properties: Record<string, PropertyDefinition>;
  constraints: SchemaConstraint[];
}

interface PropertyDefinition {
  type: 'string' | 'number' | 'date' | 'wikilink' | 'array' | 'enum' | 'boolean';
  values?: string[];           // For enum type
  default?: unknown;
  required_if?: ConditionalRequirement;
  min?: number;                // For number type
  max?: number;                // For number type
  target_type?: string;        // For wikilink type (place, map, person)
}

interface ConditionalRequirement {
  property: string;
  equals?: unknown;
  notEquals?: unknown;
  exists?: boolean;
}

interface SchemaConstraint {
  rule: string;                // JavaScript expression
  message: string;
}
```

**SchemaService methods:**
- `loadSchemas(): Promise<SchemaNote[]>` - Load all schema notes from vault
- `getSchemaForPerson(file: TFile): SchemaNote[]` - Get applicable schemas
- `getSchemasForCollection(collection: string): SchemaNote[]`

---

### Phase 2: Validation Engine (~200 lines)

**Files to create:**
- `src/schemas/services/validation-service.ts` - Core validation logic

**ValidationService methods:**
- `validatePerson(file: TFile, schemas?: SchemaNote[]): ValidationResult`
- `validateVault(): ValidationResult[]`
- `validateProperty(value: unknown, definition: PropertyDefinition): PropertyValidationResult`
- `evaluateConstraint(frontmatter: object, constraint: SchemaConstraint): boolean`

**Types:**
```typescript
interface ValidationResult {
  file: TFile;
  personName: string;
  schema: SchemaNote;
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

interface ValidationError {
  type: 'missing_required' | 'invalid_type' | 'invalid_enum' | 'constraint_failed' | 'conditional_required';
  property?: string;
  message: string;
  constraint?: SchemaConstraint;
}

interface ValidationWarning {
  type: 'missing_optional' | 'deprecated';
  property: string;
  message: string;
}
```

**Validation rules:**
1. Required properties must exist and be non-empty
2. Enum values must match allowed list
3. Types must match (string, number, date, wikilink, array)
4. Conditional requirements (`required_if`) evaluated
5. Cross-property constraints evaluated as JavaScript expressions

---

### Phase 3: Schemas Tab UI (~300 lines)

**Files to create:**
- `src/ui/control-center/tabs/schemas-tab.ts`

**Tab structure (4 cards):**

1. **Validation card**
   - "Validate vault" button
   - Last validation timestamp
   - Quick stats: X schemas, Y people validated, Z violations

2. **Schemas gallery**
   - List/grid of schema notes with name, description, applies_to summary
   - Hover actions: Edit, Duplicate, Delete
   - Click to open schema note
   - "Create schema" and "Import JSON" buttons

3. **Recent violations card**
   - Top 10 most recent validation errors
   - Click to navigate to person note
   - "View all in Data Quality" link

4. **Schema statistics card**
   - Total schemas count
   - Schemas by scope (collection, folder, universe, all)
   - Most common violation types

---

### Phase 4: Schema Management Modals (~200 lines)

**Files to create:**
- `src/ui/modals/create-schema-modal.ts`
- `src/ui/modals/edit-schema-modal.ts`

**Create Schema Modal fields:**
- Name (required)
- Description
- Applies to: dropdown (Collection, Folder, Universe, All) + value field
- Required properties: tag input
- "Add property rule" button (opens sub-form)
- "Add constraint" button (opens sub-form)

**Property rule sub-form:**
- Property name
- Type dropdown
- Type-specific options (enum values, min/max, target_type)
- Conditional requirement toggle

**Constraint sub-form:**
- Rule expression (with syntax help)
- Error message

---

### Phase 5: Data Quality Integration (~100 lines)

**Files to modify:**
- `src/ui/control-center/tabs/data-quality-tab.ts`

**Additions:**
- New "Schema violations" section in Data Quality tab
- Filter by schema
- Filter by violation type
- "Fix with defaults" batch action for missing properties

---

### Phase 6: Context Menu & Commands (~50 lines)

**Files to modify:**
- `src/ui/context-menu.ts`
- `src/main.ts` (commands)

**Context menu additions:**
- Person note: "Validate against schemas"
- Schema note: "Edit schema", "Validate matching notes"

**Commands:**
- "Canvas Roots: Validate vault against schemas"
- "Canvas Roots: Open Schemas tab"

---

## File Structure

```
src/schemas/
├── types/
│   └── schema-types.ts          # TypeScript interfaces
├── services/
│   ├── schema-service.ts        # Schema loading/management
│   └── validation-service.ts    # Validation engine
└── index.ts                     # Barrel export

src/ui/control-center/tabs/
└── schemas-tab.ts               # New Schemas tab

src/ui/modals/
├── create-schema-modal.ts       # Create schema modal
└── edit-schema-modal.ts         # Edit schema modal
```

---

## Settings Additions

```typescript
interface CanvasRootsSettings {
  // ... existing settings

  // Schema settings
  schemasFolder: string;           // Default: "Schemas"
  validateOnTreeGeneration: boolean; // Default: false (show warnings before generating)
}
```

---

## Integration with VaultStatsService

Add to `FullVaultStats`:
```typescript
interface SchemaStats {
  totalSchemas: number;
  byScope: {
    collection: number;
    folder: number;
    universe: number;
    all: number;
  };
}
```

---

## Constraint Expression Syntax

Constraints use JavaScript expressions evaluated against frontmatter:
- Property access: `property_name` or `property.nested`
- Comparisons: `===`, `!==`, `>`, `<`, `>=`, `<=`
- Logic: `&&`, `||`, `!`
- Existence: `property !== undefined`

Examples:
- `"!died || born"` - Can't have death without birth
- `"magic_type !== 'greensight' || race !== 'direwolf'"` - Direwolves can't have greensight
- `"spouse.length <= 3"` - Maximum 3 spouses
- `"born < died"` - Birth before death (if both exist)

**Security:** Expressions are evaluated in a sandboxed context with only frontmatter properties available. No access to `window`, `document`, `require`, etc.

---

## Testing Strategy

1. **Unit tests** for validation logic
   - Type validation (string, number, date, enum, wikilink, array)
   - Required property checks
   - Conditional requirements
   - Constraint evaluation

2. **Integration tests**
   - Schema loading from vault
   - Applying schemas to person notes
   - Full vault validation

3. **Manual testing**
   - UI components in Schemas tab
   - Create/edit schema modals
   - Data Quality integration

---

## Migration Notes

- No breaking changes to existing data
- New `type: schema` notes are opt-in
- Existing Data Quality checks continue to work independently

---

## Implementation Order

1. Phase 1: Core types and schema loading
2. Phase 2: Validation engine
3. Phase 3: Schemas tab UI (basic version)
4. Phase 4: Schema management modals
5. Phase 5: Data Quality integration
6. Phase 6: Context menu and commands

Total estimated lines: ~1000 new lines across 8 files
