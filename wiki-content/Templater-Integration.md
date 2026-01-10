# Templater Integration

Charted Roots works well with the [Templater](https://github.com/SilentVoid13/Templater) plugin for creating person, place, event, and source notes with consistent formatting and unique identifiers.

---

## Table of Contents

- [Why Use Templater?](#why-use-templater)
- [The cr_id Format](#the-cr_id-format)
- [Setting Up Templater](#setting-up-templater)
- [Example Templates](#example-templates)
- [Tips and Best Practices](#tips-and-best-practices)
- [Troubleshooting](#troubleshooting)
- [Related Documentation](#related-documentation)

---

## Why Use Templater?

While Charted Roots provides a context menu action to "Add essential properties" to any note, templates offer advantages:

- **Consistent format** across all notes of the same type
- **Custom fields** beyond the essential properties
- **Automatic cr_id generation** using the same alphanumeric format Charted Roots uses internally
- **Reduced errors** from copy-paste or manual entry

## The cr_id Format

Charted Roots uses a unique identifier format: `abc-123-def-456`

- Three lowercase letters
- Hyphen
- Three digits
- Hyphen
- Three lowercase letters
- Hyphen
- Three digits

This format is human-readable, easy to verify visually, and provides sufficient uniqueness for genealogical data.

## Setting Up Templater

### Method 1: Inline Generation (Simple)

Add this directly in your template frontmatter:

```yaml
---
cr_id: <% `${Array.from({length:3},()=>'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random()*26)]).join('')}-${String(Math.floor(Math.random()*1000)).padStart(3,'0')}-${Array.from({length:3},()=>'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random()*26)]).join('')}-${String(Math.floor(Math.random()*1000)).padStart(3,'0')}` %>
name: <% tp.file.title %>
---
```

### Method 2: User Script (Recommended)

For cleaner templates, create a user script that can be reused across multiple templates.

#### Step 1: Create the User Script

1. In your Templater settings, set a "User script functions folder" (e.g., `Scripts/Templater`)
2. Create a file named `generateCrId.js` in that folder:

```javascript
function generateCrId() {
    const chars = 'abcdefghijklmnopqrstuvwxyz';

    const randomLetters = (count) =>
        Array.from({length: count}, () =>
            chars[Math.floor(Math.random() * chars.length)]
        ).join('');

    const randomDigits = (count) =>
        String(Math.floor(Math.random() * Math.pow(10, count)))
            .padStart(count, '0');

    return `${randomLetters(3)}-${randomDigits(3)}-${randomLetters(3)}-${randomDigits(3)}`;
}

module.exports = generateCrId;
```

#### Step 2: Use in Templates

Now you can use the function in any template:

```yaml
---
cr_id: <% tp.user.generateCrId() %>
name: <% tp.file.title %>
---
```

## Example Templates

### Person Note Template

~~~markdown
---
cr_id: <% tp.user.generateCrId() %>
cr_type: person
name: <% tp.file.title %>
born: ""
died: ""
father: ""
mother: ""
spouses: []
children: []
sources: []
group_name: ""
---

## Biography

## Family

```canvas-roots-relationships
type: immediate
```

## Timeline

```canvas-roots-timeline
sort: chronological
```
~~~

### Place Note Template

```yaml
---
cr_type: place
cr_id: place_<% tp.user.generateCrId() %>
name: <% tp.file.title %>
place_type: ""
place_category: real
parent_place: ""
coordinates:
  lat:
  long:
---

## Description

## Events at This Location
```

### Event Note Template

```yaml
---
cr_type: event
cr_id: event_<% tp.user.generateCrId() %>
title: <% tp.file.title %>
event_type: custom
date: ""
date_precision: unknown
persons: []
place: ""
sources: []
confidence: unknown
---

## Description
```

### Source Note Template

```yaml
---
cr_type: source
cr_id: <% tp.user.generateCrId() %>
title: <% tp.file.title %>
source_type: other
confidence: unknown
source_repository: ""
source_date: ""
---

## Citation

## Extracted Information
```

## Tips and Best Practices

### Template Folder Organization

Consider organizing templates by note type:

```
Templates/
├── Person.md
├── Place.md
├── Event.md
├── Source.md
└── Organization.md
```

### Folder-Specific Templates

Use Templater's folder templates feature to automatically apply the correct template when creating notes in specific folders:

| Folder | Template |
|--------|----------|
| `People/` | `Templates/Person.md` |
| `Places/` | `Templates/Place.md` |
| `Events/` | `Templates/Event.md` |
| `Sources/` | `Templates/Source.md` |

### Combining with Essential Properties

If you have existing notes without templates, you can still use the "Add essential properties" context menu action. Both methods generate the same `cr_id` format, so they're fully compatible.

## Troubleshooting

### Script Not Found

If you see an error like `tp.user.generateCrId is not a function`:

1. Verify the user script folder path in Templater settings
2. Check that the file is named exactly `generateCrId.js`
3. Restart Obsidian after creating the script

### Different ID Formats

If you previously used a different ID format (like timestamps), Charted Roots will still recognize your notes. The `cr_id` just needs to be unique within your vault.

## Related Documentation

- [Data Entry](Data-Entry) - Creating person notes
- [Dynamic Note Content](Dynamic-Note-Content) - Timeline, relationships, and media blocks
- [Frontmatter Reference](Frontmatter-Reference) - Complete property documentation
- [Context Menus](Context-Menus) - Add essential properties action
