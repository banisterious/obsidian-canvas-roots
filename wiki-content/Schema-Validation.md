# Schema Validation

Schema validation allows you to define data consistency rules for your person notes. Schemas ensure that specific properties exist, have correct types, and satisfy custom constraints.

---

## Table of Contents

- [Overview](#overview)
- [Schema Note Format](#schema-note-format)
- [Creating Schemas](#creating-schemas)
- [Schema Scope](#schema-scope)
- [Property Types](#property-types)
- [Conditional Requirements](#conditional-requirements)
- [Constraints](#constraints)
- [Running Validation](#running-validation)
- [Data Quality Integration](#data-quality-integration)
- [Commands and Context Menu](#commands-and-context-menu)
- [Examples](#examples)

---

## Overview

Schemas are special notes (with `cr_type: schema` in frontmatter) that define validation rules for person notes. Use schemas to:

- **Enforce required properties**: Ensure all people in a collection have specific fields
- **Validate data types**: Check that dates are dates, numbers are numbers, etc.
- **Restrict values**: Limit properties to specific enum values
- **Cross-validate**: Ensure logical consistency (e.g., death date after birth date)
- **Validate wikilinks**: Verify that linked notes exist and have the correct type

Schemas follow a **UI-first design** - you can create and manage them entirely through the Control Center without manually editing files.

---

## Schema Note Format

Schema notes use flat frontmatter properties (Obsidian best practice) with the schema definition in a JSON code block.

### Frontmatter Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `string` | Yes | Must be `"schema"` |
| `cr_id` | `string` | Yes | Unique identifier |
| `name` | `string` | Yes | Display name |
| `description` | `string` | No | Optional description |
| `applies_to_type` | `string` | Yes | Scope type: `collection`, `folder`, `universe`, or `all` |
| `applies_to_value` | `string` | Conditional | Required for `collection`, `folder`, `universe` scopes |

### JSON Code Block

The schema definition is stored in a fenced code block with language `json schema` (or just `json`):

````
---
cr_type: schema
cr_id: schema-example-001
name: Example Schema
description: Validates example properties
applies_to_type: all
---

# Example Schema

This schema validates all person notes.

```json schema
{
  "requiredProperties": ["name", "born"],
  "properties": {
    "gender": {
      "type": "enum",
      "values": ["Male", "Female", "Other"]
    },
    "age_at_death": {
      "type": "number",
      "min": 0,
      "max": 150
    }
  },
  "constraints": []
}
```
````

---

## Creating Schemas

### Via Control Center (Recommended)

1. Open Control Center (`Ctrl/Cmd + P` → "Canvas Roots: Open control center")
2. Navigate to the **Schemas** tab
3. Click **Create schema**
4. Fill in the form:
   - **Name**: Display name for the schema
   - **Description**: Optional explanation
   - **Scope**: Who this schema applies to
   - **Required properties**: Which fields must exist
   - **Property definitions**: Type validation for specific properties
   - **Constraints**: Custom validation rules
5. Click **Create**

The modal generates the schema note automatically - no manual JSON editing required.

### Editing Existing Schemas

1. Open Control Center → **Schemas** tab
2. Find your schema in the gallery
3. Click the **Edit** button (pencil icon)
4. Modify the schema in the modal
5. Click **Save changes**

---

## Schema Scope

Schemas can apply to different subsets of person notes:

| Scope | Description | `applies_to_value` |
|-------|-------------|-------------------|
| `all` | All person notes in the vault | Not needed |
| `collection` | People with a specific `collection` property | Collection name |
| `folder` | People in a specific folder | Folder path |
| `universe` | People with a specific `universe` property | Universe name |

### Examples

**All people:**
```yaml
applies_to_type: all
```

**House Stark members:**
```yaml
applies_to_type: collection
applies_to_value: "House Stark"
```

**People in staging folder:**
```yaml
applies_to_type: folder
applies_to_value: "People/Staging"
```

**Middle-earth characters:**
```yaml
applies_to_type: universe
applies_to_value: "Middle-earth"
```

---

## Property Types

Define expected types for frontmatter properties:

| Type | Description | Additional Options |
|------|-------------|-------------------|
| `string` | Text value | - |
| `number` | Numeric value | `min`, `max` |
| `date` | Date string (YYYY, YYYY-MM, YYYY-MM-DD) | - |
| `boolean` | True/false | - |
| `enum` | One of specific values | `values` (array) |
| `wikilink` | Link to another note | `targetType` (place, map, person) |
| `array` | List of values | - |

### Number Range Validation

```json
{
  "properties": {
    "age_at_death": {
      "type": "number",
      "min": 0,
      "max": 150
    }
  }
}
```

### Enum Validation

```json
{
  "properties": {
    "gender": {
      "type": "enum",
      "values": ["Male", "Female", "Other", "Unknown"]
    }
  }
}
```

### Wikilink Target Validation

Verify that linked notes exist and have the correct type:

```json
{
  "properties": {
    "birth_place": {
      "type": "wikilink",
      "targetType": "place"
    }
  }
}
```

---

## Conditional Requirements

Properties can be required only when certain conditions are met:

```json
{
  "properties": {
    "death_place": {
      "type": "wikilink",
      "targetType": "place",
      "requiredIf": {
        "property": "died",
        "exists": true
      }
    },
    "magic_type": {
      "type": "enum",
      "values": ["warging", "greensight", "none"],
      "requiredIf": {
        "property": "has_magic",
        "equals": true
      }
    }
  }
}
```

### Condition Types

| Condition | Description |
|-----------|-------------|
| `exists: true` | Required if property has any value |
| `exists: false` | Required if property is empty/missing |
| `equals: value` | Required if property equals specific value |
| `notEquals: value` | Required if property does not equal value |

---

## Constraints

Constraints are JavaScript expressions that validate relationships between properties. They run in a sandboxed environment with access to the person's frontmatter.

```json
{
  "constraints": [
    {
      "rule": "!died || born",
      "message": "Cannot have death date without birth date"
    },
    {
      "rule": "!died || !born || new Date(died) >= new Date(born)",
      "message": "Death date must be after birth date"
    }
  ]
}
```

### Available Variables

Within constraint expressions, you can access any frontmatter property directly by name:

- `name` - Person's name
- `born` - Birth date
- `died` - Death date
- `gender` - Gender
- Any other frontmatter property

### Examples

**Death after birth:**
```json
{
  "rule": "!died || !born || new Date(died) >= new Date(born)",
  "message": "Death date must be after birth date"
}
```

**Parents cannot be same person:**
```json
{
  "rule": "!father_id || !mother_id || father_id !== mother_id",
  "message": "Father and mother cannot be the same person"
}
```

**Age validation:**
```json
{
  "rule": "!age_at_death || age_at_death <= 150",
  "message": "Age at death seems unrealistic (>150)"
}
```

---

## Running Validation

### From Schemas Tab

1. Open Control Center → **Schemas** tab
2. Click **Validate vault**
3. Review results showing:
   - Total people validated
   - Pass/fail counts
   - Error breakdown by type
   - List of violations with links to affected notes

## Commands and Context Menu

### Commands

| Command | Description |
|---------|-------------|
| `Canvas Roots: Open schemas tab` | Open Control Center to Schemas tab |
| `Canvas Roots: Validate vault against schemas` | Run full vault validation |

### Context Menu

**Person notes:**
- Right-click → Canvas Roots → **Validate against schemas**
- Validates the single person against all applicable schemas

**Schema notes:**
- Right-click → Canvas Roots → **Edit schema**
- Right-click → Canvas Roots → **Validate matching notes**
- Right-click → Canvas Roots → **Open schemas tab**

---

## Examples

### Basic Required Fields Schema

````
---
cr_type: schema
cr_id: schema-basic-required
name: Basic Required Fields
description: Ensures all people have essential information
applies_to_type: all
---

# Basic Required Fields

```json schema
{
  "requiredProperties": ["name", "cr_id"],
  "properties": {},
  "constraints": []
}
```
````

### House Stark Schema (World-Building)

````
---
cr_type: schema
cr_id: schema-house-stark
name: House Stark Schema
description: Validation rules for House Stark members
applies_to_type: collection
applies_to_value: "House Stark"
---

# House Stark Schema

```json schema
{
  "requiredProperties": ["allegiance", "combat_style"],
  "properties": {
    "race": {
      "type": "enum",
      "values": ["human", "direwolf"],
      "default": "human"
    },
    "magic_type": {
      "type": "enum",
      "values": ["warging", "greensight", "none"],
      "requiredIf": {
        "property": "has_magic",
        "equals": true
      }
    },
    "allegiance": {
      "type": "wikilink"
    },
    "birth_place": {
      "type": "wikilink",
      "targetType": "place"
    }
  },
  "constraints": [
    {
      "rule": "magic_type !== 'greensight' || race !== 'direwolf'",
      "message": "Direwolves cannot have greensight"
    }
  ]
}
```
````

### Date Validation Schema

````
---
cr_type: schema
cr_id: schema-date-validation
name: Date Validation
description: Ensures date fields are logically consistent
applies_to_type: all
---

# Date Validation Schema

```json schema
{
  "requiredProperties": [],
  "properties": {
    "born": {
      "type": "date"
    },
    "died": {
      "type": "date"
    }
  },
  "constraints": [
    {
      "rule": "!died || born",
      "message": "Cannot have death date without birth date"
    },
    {
      "rule": "!died || !born || new Date(died) >= new Date(born)",
      "message": "Death date must be on or after birth date"
    }
  ]
}
```
````

### Import Quality Schema

````
---
cr_type: schema
cr_id: schema-import-quality
name: Import Quality Check
description: Validates imported GEDCOM data in staging folder
applies_to_type: folder
applies_to_value: "People/Staging"
---

# Import Quality Check

```json schema
{
  "requiredProperties": ["name", "cr_id"],
  "properties": {
    "born": {
      "type": "date"
    },
    "gender": {
      "type": "enum",
      "values": ["Male", "Female", "M", "F"]
    }
  },
  "constraints": []
}
```
````

---

## See Also

- [Frontmatter Reference](Frontmatter-Reference) - All frontmatter properties
- [Data Management](Data-Management) - Managing your family data
- [Import & Export](Import-Export) - Importing data that needs validation
