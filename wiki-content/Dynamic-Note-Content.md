# Dynamic Note Content

Charted Roots can render live, computed content directly within person notes using special code blocks. These blocks automatically display data from your vault and update when you view the note.

---

## Table of Contents

- [Overview](#overview)
- [Block Types](#block-types)
  - [Timeline Block](#timeline-block)
  - [Relationships Block](#relationships-block)
  - [Media Block](#media-block)
- [Rendered Output](#rendered-output)
- [Freeze to Markdown](#freeze-to-markdown)
- [Inserting Blocks](#inserting-blocks)
- [Tips](#tips)
- [Related Features](#related-features)

---

## Overview

Dynamic content blocks solve the problem of person notes containing only static frontmatter. With these blocks, you can see a person's complete timeline, family relationships, and more without leaving the note.

**Key Features:**
- **Live rendering**: Content computed from your vault data
- **Freeze to markdown**: Convert to static text for editing or export
- **Configurable**: Options for sorting, filtering, and display
- **Multiple insertion methods**: Command palette, context menu, import wizards

## Block Types

### Timeline Block

The `canvas-roots-timeline` block shows a chronological list of events for a person.

~~~markdown
```canvas-roots-timeline
sort: chronological
```
~~~

**What it displays:**
- Birth and death dates from the person's frontmatter
- All event notes linked to this person
- Year, event type, and place for each entry
- Clickable wikilinks to event and place notes

**Configuration options:**

| Option | Values | Description |
|--------|--------|-------------|
| `sort` | `chronological`, `reverse` | Event order (default: chronological) |
| `include` | comma-separated types | Only show these event types |
| `exclude` | comma-separated types | Hide these event types |
| `limit` | number | Maximum events to display |
| `title` | string | Custom header text (default: "Timeline") |

**Example with options:**

~~~markdown
```canvas-roots-timeline
sort: reverse
exclude: residence, occupation
limit: 10
title: Key Life Events
```
~~~

### Relationships Block

The `canvas-roots-relationships` block displays family members with clickable links.

~~~markdown
```canvas-roots-relationships
type: immediate
```
~~~

**What it displays:**
- Parents (father, mother)
- Spouse(s)
- Children
- Siblings (when using `type: extended` or `type: all`)

Each person is shown as a wikilink with their birth-death years.

**Configuration options:**

| Option | Values | Description |
|--------|--------|-------------|
| `type` | `immediate`, `extended`, `all` | Relationship scope (default: immediate) |
| `include` | comma-separated types | Only show these relationship types |
| `exclude` | comma-separated types | Hide these relationship types |
| `title` | string | Custom header text (default: "Family") |

**Relationship types:**
- `immediate`: Parents, spouse, children (no siblings)
- `extended`: Adds siblings
- `all`: All relationships including extended family

**Example with options:**

~~~markdown
```canvas-roots-relationships
type: extended
title: Family Tree
```
~~~

### Media Block

The `canvas-roots-media` block displays a gallery of media files linked to the person.

~~~markdown
```canvas-roots-media
columns: 3
size: medium
```
~~~

**What it displays:**
- All media files linked via the `media` frontmatter property
- Image thumbnails in a responsive grid
- Document placeholders for non-image files (PDFs, etc.)
- First item highlighted as the "thumbnail" (used for Family Chart avatars)

**Configuration options:**

| Option | Values | Description |
|--------|--------|-------------|
| `columns` | 2-6, `auto` | Number of columns in grid (default: 3) |
| `size` | `small`, `medium`, `large` | Thumbnail size (default: medium) |
| `editable` | `true`, `false` | Enable drag-to-reorder (default: false) |
| `title` | string | Custom header text (default: "Media") |

**Example with options:**

~~~markdown
```canvas-roots-media
columns: 4
size: large
editable: true
title: Photos & Documents
```
~~~

**Editable Mode:**

When `editable: true` is set:
- Items show a drag handle on hover
- Drag items to reorder their position
- First item becomes the thumbnail (shown on Family Chart nodes)
- Frontmatter is updated automatically when you drop
- Gallery has a dashed border to indicate edit mode

## Rendered Output

In reading view, code blocks render as styled containers:

```
┌─────────────────────────────────────────────┐
│ Timeline                               [❄️] │
├─────────────────────────────────────────────┤
│ • 1845 — Born in [[Dublin, Ireland]]        │
│ • 1867 — Married [[Jane Smith]]             │
│ • 1890 — Resided in [[Boston, MA]]          │
│ • 1912 — Died in [[Boston, MA]]             │
└─────────────────────────────────────────────┘
```

**Toolbar buttons:**
- ❄️ **Freeze**: Convert to static markdown
- 📋 **Copy**: Copy timeline text to clipboard (timeline only)

**Empty states:**
- If no data is found, blocks show a helpful message
- Example: "No events found for this person"

## Freeze to Markdown

Click the ❄️ freeze button to convert a live block to static markdown. This is useful for:

- **Manual editing**: Add notes, reorder items, customize formatting
- **Export compatibility**: Static markdown works everywhere
- **Performance**: Reduce computation in large vaults

**Before freezing:**

~~~markdown
```canvas-roots-timeline
sort: chronological
```
~~~

**After freezing:**

```markdown
## Timeline

- **1845** — Born in [[Dublin, Ireland]]
- **1867** — [[Marriage of John and Jane|Married]] in [[Boston, MA]]
- **1912** — Died in [[Boston, MA]]
```

The frozen content preserves wikilinks and can be edited like any markdown.

**Media gallery freeze:**

Media galleries freeze to a styled callout that displays images in a responsive grid:

~~~markdown
> [!info|cr-frozen-gallery]
> ![[portrait.jpg]]
> ![[wedding-photo.jpg]]
> ![[birth-certificate.pdf]]
~~~

The frozen gallery:
- Uses Obsidian's native callout syntax with a special `cr-frozen-gallery` metadata tag
- Renders images in a flex layout with configurable styling
- Click-and-hold on an image to zoom to full screen
- Styling can be customized via the Style Settings plugin

## Inserting Blocks

### Create Person Modal

When creating a new person note via the Create Person modal, enable the "Include dynamic blocks" toggle to automatically add timeline, relationships, and media blocks to the note body.

### Import Wizards

All import wizards (GEDCOM, Gramps, CSV) include an "Include dynamic blocks" toggle. When enabled, imported person notes will include all three block types. Media blocks are included with `editable: true` by default.

### Context Menu

Right-click on a person note in the file explorer:

1. Select **Insert dynamic blocks**
2. Timeline, relationships, and media blocks are added to the note body

### Bulk Insert (Folders)

Right-click on a folder containing person notes:

1. Select **Insert dynamic blocks in folder**
2. A progress modal shows the operation
3. Blocks are added to all person notes in the folder that don't already have them

### Command Palette

Use the command palette (`Ctrl/Cmd + P`):

- **Charted Roots: Insert dynamic blocks** - Adds blocks to the current note

### Manual Entry

Type the code block syntax directly in any person note:

~~~markdown
```canvas-roots-timeline
```

```canvas-roots-relationships
```
~~~

## Tips

- **Placement**: Add blocks after your frontmatter and any static content you want to keep at the top
- **Multiple blocks**: You can have both timeline and relationships blocks in the same note
- **Re-ordering**: Frozen content can be moved anywhere in the note
- **Performance**: For large vaults (1000+ people), consider using frozen blocks to avoid computation on every note open
- **cr_id required**: Blocks only work in notes with a valid `cr_id` property

## Related Features

- [Events & Timelines](Events-And-Timelines) - Creating and managing event notes
- [Context Menus](Context-Menus) - All available right-click actions
- [Import & Export](Import-Export) - Import wizards with dynamic block toggle
- [Data Entry](Data-Entry) - Creating person notes
