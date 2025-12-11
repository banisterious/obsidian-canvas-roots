# Data Entry

This page covers how to create person notes with relationship data that Canvas Roots uses to generate family trees.

> **Reference:** For a complete list of all supported properties, see the [Frontmatter Reference](Frontmatter-Reference).

## Quick Start: Adding Properties via Context Menu

The fastest way to set up a person note is using the context menu:

1. Create a new markdown note for the person
2. Right-click the file in the file explorer
3. Select **Canvas Roots → Add essential person properties**

This automatically adds all required fields (`cr_id`, `cr_type`, `name`) plus common optional fields (`born`, `died`, `father`, `mother`, `spouse`). You can also select multiple files and add properties to all of them at once.

> **Tip:** See [Context Menus](Context-Menus) for all available right-click actions.

## Individual Markdown Notes

Create individual notes for each person with YAML frontmatter containing relationship data.

### Required Fields

- `cr_id`: Unique identifier (UUID format recommended)
- `cr_type`: Must be `"person"` for person notes
- `name`: Person's name

### Optional Relationship Fields

- `father`: Wikilink to father's note
- `father_id`: Father's `cr_id` value
- `mother`: Wikilink to mother's note
- `mother_id`: Mother's `cr_id` value
- `spouse`: Wikilink(s) to spouse(s)
- `spouse_id`: Spouse `cr_id` value(s)
- `children`: Array of wikilinks to children
- `children_id`: Array of children's `cr_id` values

### Optional Date Fields

- `born`: Birth date (YYYY-MM-DD format recommended)
- `died`: Death date (YYYY-MM-DD format recommended)

## Example Person Note

```yaml
---
cr_id: abc-123-def-456
cr_type: person
name: John Robert Smith
father: "[[John Smith Sr]]"
father_id: xyz-789-uvw-012
mother: "[[Jane Doe]]"
mother_id: pqr-345-stu-678
spouse: ["[[Mary Jones]]"]
spouse_id: ["mno-901-jkl-234"]
children: ["[[Bob Smith]]", "[[Alice Smith]]"]
children_id: ["def-456-ghi-789", "abc-123-xyz-456"]
born: 1888-05-15
died: 1952-08-20
---

# Research Notes

[Your biographical research, sources, and notes here...]
```

## Multiple Spouse Support

For complex marital histories, use indexed spouse properties:

```yaml
---
cr_id: abc-123-def-456
cr_type: person
name: John Robert Smith

# First spouse
spouse1: "[[Jane Doe]]"
spouse1_id: "jane-cr-id-123"
spouse1_marriage_date: "1985-06-15"
spouse1_divorce_date: "1992-03-20"
spouse1_marriage_status: divorced
spouse1_marriage_location: "Boston, MA"

# Second spouse
spouse2: "[[Mary Johnson]]"
spouse2_id: "mary-cr-id-456"
spouse2_marriage_date: "1995-08-10"
spouse2_marriage_status: current
spouse2_marriage_location: "Seattle, WA"
---
```

### Indexed Spouse Properties

For each spouse (spouse1, spouse2, etc.), you can specify:

| Property | Description | Example |
|----------|-------------|---------|
| `spouseN` | Wikilink to spouse's note | `"[[Jane Doe]]"` |
| `spouseN_id` | Spouse's cr_id | `"jane-cr-id-123"` |
| `spouseN_marriage_date` | Wedding date | `"1985-06-15"` |
| `spouseN_divorce_date` | Divorce date (if applicable) | `"1992-03-20"` |
| `spouseN_marriage_status` | Status: current, divorced, widowed, annulled | `divorced` |
| `spouseN_marriage_location` | Wedding location | `"Boston, MA"` |

## Wikilinks vs IDs

Canvas Roots supports both wikilinks and ID-based relationships:

**Wikilinks** (`father`, `mother`, `spouse`, `children`):
- Human-readable in your notes
- Work with Obsidian's graph view and backlinks
- Require exact note name matches

**IDs** (`father_id`, `mother_id`, `spouse_id`, `children_id`):
- More robust - survive note renames
- Required for GEDCOM import/export
- Enable bidirectional sync features

**Best Practice:** Use both for maximum compatibility:

```yaml
father: "[[John Smith Sr]]"
father_id: xyz-789-uvw-012
```

## Bulk Data Entry

For entering many family members at once, consider using [Obsidian Bases](Bases-Integration) which provides a spreadsheet-like interface for editing frontmatter across multiple notes.

## Other Data Types

Canvas Roots also supports Places and Organizations, each with their own data entry workflows:

### Place Notes

Geographic locations for births, deaths, and other events. Place notes support:
- Coordinates (latitude/longitude) for map visualization
- Hierarchical relationships (parent places)
- Categories and universes for fictional locations

See [Geographic Features](Geographic-Features) for complete documentation.

### Organization Notes

Groups, institutions, and affiliations that people belong to. Organization notes support:
- Organization types (guild, corporation, noble house, etc.)
- Member relationships linking people to organizations
- Universe support for fictional world-building

See [Organization Notes](Organization-Notes) for complete documentation.

## Next Steps

- [Templater Integration](Templater-Integration) - Use templates for consistent note creation
- [Bases Integration](Bases-Integration) - Spreadsheet-like bulk editing
- [Frontmatter Reference](Frontmatter-Reference) - Complete property documentation
- [Import & Export](Import-Export) - Import from GEDCOM or CSV
- [Geographic Features](Geographic-Features) - Place notes and maps
- [Organization Notes](Organization-Notes) - Organizations and memberships
