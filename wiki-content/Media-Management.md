# Media Management

Charted Roots provides comprehensive tools for managing media files (photos, documents, scans) linked to your genealogical data. Media can be attached to people, events, places, organizations, and sources.

---

## Table of Contents

- [The media Property](#the-media-property)
- [Media Manager](#media-manager)
  - [Linked Media Gallery](#linked-media-gallery)
  - [Bulk Link Media](#bulk-link-media)
  - [Find Unlinked](#find-unlinked)
  - [Source Media Linker](#source-media-linker)
- [Dynamic Media Gallery](#dynamic-media-gallery)
- [Gramps Media Import](#gramps-media-import)
- [Media Folder Settings](#media-folder-settings)
- [Supported File Types](#supported-file-types)

---

## The media Property

The `media` property stores links to media files in any entity's frontmatter. It supports both single files and arrays:

**Single file:**
```yaml
media: "[[john-smith-portrait.jpg]]"
```

**Multiple files:**
```yaml
media:
  - "[[portrait.jpg]]"
  - "[[birth-certificate.pdf]]"
  - "[[wedding-photo-1920.jpg]]"
```

The **first item** in the array is treated as the **thumbnail** and is displayed on Family Chart person cards.

**Supported entity types:**
- Person notes
- Event notes
- Place notes
- Organization notes
- Source notes

---

## Media Manager

The Media Manager is a central hub for all media operations. Open it from:

- **Dashboard → Media tile → Open Media Manager**
- **Command palette**: "Charted Roots: Open media manager"

The modal displays four action tiles and a stats bar showing your media coverage.

### Linked Media Gallery

**Purpose:** Browse all media files currently linked to entities in your vault.

**Features:**
- Grid view of all linked media with thumbnails
- Filter by entity type (Person, Event, Place, Organization, Source)
- Search by filename
- Click to open the media file
- Shows which entity each file is linked to

**Use case:** Get an overview of your linked media, find a specific photo, or verify linking.

### Bulk Link Media

**Purpose:** Link media files to multiple entities at once.

**Workflow:**
1. Select an entity type (People, Events, Places, Organizations, Sources)
2. View entities that don't have media attached
3. Select one or more entities
4. Pick media files from a file picker
5. Execute bulk linking

**Features:**
- Shows entities without media, organized by type
- Multi-select for batch operations
- Progress tracking for large operations
- Works with preselected files from Find Unlinked

**Use case:** After importing media files, quickly attach them to the relevant entities.

### Find Unlinked

**Purpose:** Discover media files in your vault that aren't linked to any entity.

**Features:**
- Grid view of orphaned media files
- Filter by media type (images, videos, audio, documents)
- Search by filename
- Bulk selection for batch operations
- Direct action to link selected files to entities

**Workflow:**
1. Review orphaned files in the grid
2. Select files you want to link
3. Click "Link Selected" to open Bulk Link Media with files preselected
4. Choose entities and complete linking

**Use case:** Clean up after imports, find forgotten photos, ensure all media is properly attached.

### Source Media Linker

**Purpose:** Smart matching to link images to source notes based on filename patterns.

This is a multi-step wizard specifically for linking media to sources:

**Step 1: Select Media Folder**
- Choose a folder containing source images
- Options to exclude thumbnails and hidden files
- Shows count of images found

**Step 2: Review & Link**
- View images with suggested source matches
- Suggestions based on filename similarity to source names
- Manual override if automatic matching is incorrect
- Skip files that shouldn't be linked

**Step 3: Execute**
- Apply all links in batch
- Progress tracking
- Summary of results

**Use case:** After scanning genealogical documents, efficiently link the scans to your source notes using intelligent filename matching.

---

## Dynamic Media Gallery

Display media in person notes using the `canvas-roots-media` code block:

~~~markdown
```canvas-roots-media
columns: 3
size: medium
editable: true
```
~~~

**Configuration options:**

| Option | Values | Description |
|--------|--------|-------------|
| `columns` | 2-6, `auto` | Number of columns in grid (default: 3) |
| `size` | `small`, `medium`, `large` | Thumbnail size (default: medium) |
| `editable` | `true`, `false` | Enable drag-to-reorder (default: false) |
| `title` | string | Custom header text (default: "Media") |

**Editable mode features:**
- Drag items to reorder
- First item becomes the thumbnail (shown on Family Chart nodes)
- Frontmatter updates automatically when you drop

**Inserting the block:**

1. **During import**: Enable "Include dynamic content blocks" in GEDCOM or Gramps import
2. **Context menu**: Right-click a person note → "Insert dynamic blocks"
3. **Command palette**: "Charted Roots: Insert dynamic blocks"
4. **Manually**: Type the code block syntax in any person note

**Freeze to callout:**

Click the freeze (❄️) button to convert to a static callout:

~~~markdown
> [!info|cr-frozen-gallery]
> ![[portrait.jpg]]
> ![[wedding-photo.jpg]]
~~~

See [Dynamic Note Content](Dynamic-Note-Content#media-block) for full documentation.

---

## Gramps Media Import

When importing a Gramps Package (`.gpkg`) file, media files are automatically extracted and linked:

1. Select a `.gpkg` file in the Import tab
2. Media files are extracted to your configured media folder
3. Person, event, place, and source notes are created with `media` properties linking to the extracted files

**Requirements:**
- The `.gpkg` file must be a valid ZIP archive containing Gramps XML and media files
- Media files are extracted with their original folder structure preserved

See [Import & Export](Import-Export#gramps-xml--gpkg) for full import documentation.

---

## Media Folder Settings

Control which folders Charted Roots scans for media files.

**Location:** Control Center → Preferences → Media

| Setting | Description |
|---------|-------------|
| **Limit media scanning to specified folders** | Toggle to enable folder filtering |
| **Media folders** | List of folders to scan (one per line) |

**What this affects:**
- Find Unlinked results
- Media Manager statistics
- Media picker file lists

**What this does NOT affect:**
- Already-linked media (always displayed)
- Linked Media Gallery (shows all linked media regardless of location)

**Use case:** If you store media in specific folders (e.g., `Assets/Genealogy/Photos`), enable this to avoid scanning unrelated files.

---

## Supported File Types

Charted Roots supports a variety of media file types:

| Category | Extensions |
|----------|------------|
| **Images** | `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.svg`, `.bmp`, `.tiff`, `.tif` |
| **Video** | `.mp4`, `.webm`, `.mov`, `.avi`, `.mkv` |
| **Audio** | `.mp3`, `.wav`, `.ogg`, `.flac`, `.m4a` |
| **PDF** | `.pdf` |
| **Documents** | `.doc`, `.docx`, `.odt`, `.txt`, `.rtf` |

**Notes:**
- Images display as thumbnails in galleries and on Family Chart cards
- Non-image files display with type-specific placeholder icons
- PDFs can be opened directly in Obsidian

---

## See Also

- [Dynamic Note Content](Dynamic-Note-Content) - Timeline, relationships, and media blocks
- [Evidence & Sources](Evidence-And-Sources) - Managing source notes and citations
- [Import & Export](Import-Export) - Importing media from Gramps packages
- [Family Chart View](Family-Chart-View) - Media thumbnails on person cards
