# Universal Media Linking

Planning document for extending media attachment support to all entity types.

- **Status:** Complete (Phases 1, 2, 3, 3.5, 4 & 5)
- **Priority:** High
- **GitHub Issue:** [#20](https://github.com/banisterious/obsidian-charted-roots/issues/20)
- **Branch:** `feature/universal-media-linking`
- **Created:** 2025-12-20
- **Updated:** 2025-12-22

### Recent Changes (2025-12-22)

- Fixed Media Gallery and Unlinked Media modals not finding linked media (missing `ensureCacheLoaded()` call)
- Added YAML array format support for `media` property in SourceService
- Fixed Unlinked Media modal styling (CSS `:has()` selector pattern, search field styling)
- Implemented Phase 3.5: Media Folder Filter (settings, UI, and filter logic)
- Renamed "Browse Gallery" to "Linked Media Gallery" for UX clarity
- Added in-modal toggle for media folder filter to Linked Media Gallery and Find Unlinked modals
- **SVG export with avatars now works for large trees (100+ avatars)**:
  - Avatar images downscaled to 150px max
  - Converted to JPEG at 85% quality (much smaller than PNG)
  - 50ms delay between images for garbage collection
  - Warning with depth limit suggestion for large exports
- **Phase 4: Gramps Package (.gpkg) Import**:
  - Added JSZip dependency for archive extraction
  - Created `gpkg-extractor.ts` with support for multiple archive formats:
    - ZIP archives (via JSZip)
    - Gzip-compressed tar archives (.tar.gz) — implemented native tar parser
    - Gzip-compressed XML (plain gzip without tar)
  - Updated control-center to accept .gpkg files
  - Added GrampsMedia type and media object parsing
  - Media files extracted to vault during import
  - Added 'media' phase to import progress modal
  - Media linked to source notes via mediaRefs
  - **Media linking to Person, Event, Place notes**:
    - Added `mediaRefs` field to GrampsPerson, GrampsEvent, GrampsPlace types
    - Parser extracts `<objref>` elements from Person/Event/Place
    - Import resolves media handles to vault wikilinks for all entity types

---

## Overview

Extend the `media` property (currently only supported on Source notes) to Person, Event, Place, and Organization notes. This enables linking images, documents, and other media files to any entity type, provides foundation for Gramps Package (`.gpkg`) import support, and displays person thumbnails on Family Chart nodes.

---

## Problem Statement

Currently, media attachment is only available for Source notes. This limits users who want to:

1. **Attach photos to people** — Character portraits, historical photographs, scanned documents
2. **Document events visually** — Ceremony photos, certificates, newspaper clippings
3. **Illustrate places** — Location photos, historical maps, property records
4. **Brand organizations** — Logos, heraldry, group photos

Additionally, Gramps exports as `.gpkg` packages bundle media files with XML data, but Charted Roots cannot import these because other entity types don't support media.

---

## Current State

### Source Notes Only

The `media` property is currently defined only in `SourceNote`:

```typescript
// src/sources/types/source-types.ts
export interface SourceNote {
  // ...
  /** Media file wikilinks (aggregated from media, media_2, etc.) */
  media: string[];
  // ...
}
```

### Existing Infrastructure

| Component | Location | Description |
|-----------|----------|-------------|
| `SourceNote.media` | `src/sources/types/source-types.ts` | Array of wikilink strings |
| `MediaGallery` | `src/sources/ui/media-gallery.ts` | Thumbnail grid with lightbox |
| `MediaItem` interface | `src/sources/ui/media-gallery.ts` | Resolved media file info |
| Image extensions | `src/sources/ui/media-gallery.ts` | `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.svg`, `.bmp`, `.tiff`, `.tif` |
| Document extensions | `src/sources/ui/media-gallery.ts` | `.pdf`, `.doc`, `.docx`, `.xls`, `.xlsx`, `.ppt`, `.pptx` |
| Indexed property parsing | `src/core/family-graph.ts` | Parses `media`, `media_2`, `media_3`, etc. |
| Bulk Source-Image Linking | `src/sources/ui/bulk-media-link-modal.ts` | Links images to sources in batch |

### Entity Types Without Media

| Entity | Type File | Needs `media` Added |
|--------|-----------|---------------------|
| **Person** | `src/core/family-graph.ts` → `PersonNode` | Yes |
| **Event** | `src/events/types/event-types.ts` → `EventNote` | Yes |
| **Place** | `src/places/types/place-types.ts` | Yes (needs interface) |
| **Organization** | `src/organizations/types/organization-types.ts` → `OrganizationInfo` | Yes |

---

## Solution Design

### Schema Changes

Add `media: string[]` to all entity type interfaces, using YAML array syntax:

```yaml
# Person note
---
cr_type: person
cr_id: john-smith
name: John Smith
media:
  - "[[photos/john-smith-portrait.jpg]]"
  - "[[documents/john-smith-birth-cert.pdf]]"
---

# Event note
---
cr_type: event
cr_id: wedding-1902
event_type: marriage
media:
  - "[[photos/wedding-ceremony.jpg]]"
---

# Place note
---
cr_type: place
cr_id: dublin-ireland
name: Dublin, Ireland
media:
  - "[[photos/dublin-1920s.jpg]]"
  - "[[maps/dublin-historical.png]]"
---

# Organization note
---
cr_type: organization
cr_id: house-stark
name: House Stark
media:
  - "[[images/stark-sigil.png]]"
---
```

> **Note:** This uses YAML array syntax rather than indexed properties (`media_2`, `media_3`, etc.). The existing `source_*` indexed pattern will be migrated to arrays in a future update. See [source-array-migration.md](./source-array-migration.md).

### Thumbnail Selection

The first media item serves as the display thumbnail by default. Users control which item is the thumbnail by reordering the media list via drag-and-drop UI.

**Design Principle:** First-is-thumbnail rule with UI-based reordering provides the best UX:

| Approach | Pros | Cons |
|----------|------|------|
| ~~Explicit `thumbnail` field~~ | Clear intent | Schema bloat, orphan risk |
| ~~`thumbnail_index` field~~ | Non-destructive | Fragile if list changes |
| **Drag-and-drop reorder** ✓ | No new fields, intuitive, WYSIWYG | Requires UI component |

**Where thumbnails appear:**

- **Person nodes** on Family Chart display thumbnail in corner
- **Place markers** on map could show thumbnail on hover
- **Organization hierarchy** could show logo/sigil

**Reorder UI locations:**

| Location | Description |
|----------|-------------|
| Control Center entity tables | Click entity row → media panel with drag handles |
| Context menu | "Manage media..." opens reorder modal |
| Dynamic Note Content | `<!-- cr:media-gallery editable -->` with inline reordering |

**Optional override:** For edge cases (e.g., using a cropped version not in the media list), an explicit `thumbnail` field can override the first-media default:

```yaml
thumbnail: "[[cropped-portrait.jpg]]"  # Optional override
media:
  - "[[full-portrait.jpg]]"
  - "[[document.pdf]]"
```

Resolution order:
1. If `thumbnail` is set → use it
2. Else if `media` exists → use first media item
3. Else → show fallback (initials/icon)

### MediaService Architecture

Create entity-agnostic `MediaService` for shared functionality:

```
┌─────────────────────────────────────────────────────────────┐
│                       MediaService                           │
│  (Entity-agnostic media linking, resolution, galleries)      │
├─────────────────────────────────────────────────────────────┤
│  - getMediaForEntity(entityType, crId)                       │
│  - linkMediaToEntity(entityType, crId, mediaPath)            │
│  - unlinkMediaFromEntity(entityType, crId, mediaPath)        │
│  - resolveMediaItem(mediaRef): MediaItem                     │
│  - getFirstMedia(entity): TFile | null  // thumbnail         │
│  - getAllMediaItems(): MediaItem[]  // for gallery           │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ FamilyGraph     │  │ EventService    │  │ PlaceGraph      │
│ PersonNode      │  │ EventNote       │  │ PlaceNode       │
└─────────────────┘  └─────────────────┘  └─────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Family Chart    │  │ Timeline View   │  │ Map View        │
│ (thumbnails)    │  │ (event media)   │  │ (place images)  │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

---

## Use Cases

### Genealogy

| Entity | Use Cases |
|--------|-----------|
| **Person** | Portrait photos, scanned vital records, family photos |
| **Event** | Marriage certificates, baptism records, newspaper clippings |
| **Place** | Historical photos of ancestral homes, property records, maps |
| **Organization** | Church photos, military unit insignia, company logos |

### Worldbuilding

| Entity | Use Cases |
|--------|-----------|
| **Person** | Character portraits, concept art, reference images for visual consistency |
| **Place** | Location art, fantasy maps, floor plans, setting mood boards |
| **Event** | Scene illustrations, battle maps, timeline graphics |
| **Organization** | Faction banners, house sigils, guild logos, heraldry |

Canvas thumbnails are particularly useful for writers—seeing character faces on relationship maps makes it easier to visualize story dynamics.

---

## Phased Implementation

### Phase 1: Schema Extension

**Focus:** Add `media` property to all entity types.

#### Scope

1. **Type definitions**
   - Add `media: string[]` to `PersonNode` interface in `src/core/family-graph.ts`
   - Add `media: string[]` to `EventNote` interface in `src/events/types/event-types.ts`
   - Add `PlaceNote` interface with `media: string[]` to `src/places/types/place-types.ts`
   - Add `media: string[]` to `OrganizationInfo` interface in `src/organizations/types/organization-types.ts`

2. **Property parsing**
   - Update `extractPersonNode()` to parse `media`, `media_2`, etc.
   - Update `extractEventNote()` to parse media properties
   - Update `PlaceGraphService` to parse media properties
   - Update `OrganizationService` to parse media properties
   - Reuse indexed property parsing pattern from Sources

3. **MediaService creation**
   - Create `src/core/media-service.ts`
   - Implement `resolveMediaItem()` (refactor from `media-gallery.ts`)
   - Implement `getMediaForEntity(entityType, crId)`
   - Implement `getFirstMedia(entity)` for thumbnail access

4. **Property aliases**
   - Add `media` to property alias system for all entity types

#### Implementation Notes

```typescript
// src/core/media-service.ts
export interface EntityMedia {
  entityType: 'person' | 'event' | 'place' | 'organization' | 'source';
  entityCrId: string;
  entityName: string;
  entityFile: TFile;
  media: MediaItem[];
}

export class MediaService {
  constructor(private app: App, private settings: CanvasRootsSettings) {}

  /**
   * Parse media array from frontmatter
   * Expects YAML array format:
   *   media:
   *     - "[[file1.jpg]]"
   *     - "[[file2.jpg]]"
   */
  parseMediaProperty(frontmatter: Record<string, unknown>): string[] {
    if (!frontmatter.media) return [];

    // Handle both array and single value (for backwards compatibility)
    if (Array.isArray(frontmatter.media)) {
      return frontmatter.media.filter((item): item is string => typeof item === 'string');
    }

    // Single value - wrap in array
    if (typeof frontmatter.media === 'string') {
      return [frontmatter.media];
    }

    return [];
  }

  /**
   * Get the first media item as a thumbnail
   */
  getFirstMediaAsThumbnail(entity: { media: string[] }): TFile | null {
    if (!entity.media?.length) return null;

    const firstRef = entity.media[0];
    const item = this.resolveMediaItem(firstRef);
    return item.file;
  }
}
```

#### Files to Create

| File | Purpose |
|------|---------|
| `src/core/media-service.ts` | Entity-agnostic media service |

#### Files to Modify

| File | Changes |
|------|---------|
| `src/core/family-graph.ts` | Add `media` to `PersonNode`, parse in `extractPersonNode()` |
| `src/events/types/event-types.ts` | Add `media` to `EventNote` |
| `src/events/services/event-service.ts` | Parse media properties |
| `src/places/types/place-types.ts` | Add `PlaceNote` interface with `media` |
| `src/places/services/place-graph-service.ts` | Parse media properties |
| `src/organizations/types/organization-types.ts` | Add `media` to `OrganizationInfo` |
| `src/organizations/services/organization-service.ts` | Parse media properties |
| `src/core/property-alias-service.ts` | Add media aliases for all entity types |

---

### Phase 2: UI Integration

**Focus:** Context menus, bulk linking, and media indicators.

#### Scope

1. **Context menu actions**
   - Add "Link Media" and "Manage media..." to **Charted Roots** submenu
   - All Charted Roots actions grouped under single submenu
   - Opens file picker modal with search and filters
   - Adds wikilink to entity's `media` array

2. **Link Media Modal (File Picker)**
   - FuzzySuggestModal-based file picker
   - Search field with filters:
     - **File type:** All types, Images, Documents, Video, Audio
     - **File age:** Any age, Today, This week, This month, This year
     - **File size:** Any size, < 100KB, 100KB - 1MB, > 1MB
   - Shows thumbnail preview for images
   - Displays file path

3. **Bulk Media Linking tool**
   - Extend existing bulk linking modal
   - Add entity type selector (Person, Event, Place, Organization, Source)
   - Show entities without media for linking
   - Support batch linking from folder

4. **Control Center integration**
   - Add media column/indicator to entity tables in each tab
   - Show media count or thumbnail indicator
   - **Row context menu** with:
     - Open note
     - Link media
     - Manage media...
     - Open in default app
     - Reveal in explorer
     - Copy path

5. **Unified Media Gallery**
   - Extend gallery to show media from all entity types
   - Add entity type filter
   - Group by entity type option

6. **Media Order UI (Thumbnail Selection)**
   - Drag-and-drop reorderable media list
   - First item highlighted as "Thumbnail"
   - Accessible from context menu ("Manage media...")
   - Accessible from Control Center entity rows
   - Updates frontmatter on save

#### Implementation Notes

**Context Menu (Charted Roots Submenu):**

```typescript
// All Charted Roots actions under submenu
menu.addItem((item) => {
  item
    .setTitle('Charted Roots')
    .setIcon('trees')
    .setSubmenu()
    .addItem((sub) => {
      sub
        .setTitle('Link media')
        .setIcon('image-plus')
        .onClick(() => new LinkMediaModal(this.app, entity).open());
    })
    .addItem((sub) => {
      sub
        .setTitle('Manage media...')
        .setIcon('list')
        .onClick(() => new MediaOrderModal(this.app, entity).open());
    });
});
```

**Link Media Modal with Filters:**

```typescript
interface MediaPickerFilters {
  fileType: 'all' | 'image' | 'document' | 'video' | 'audio';
  fileAge: 'all' | 'today' | 'week' | 'month' | 'year';
  fileSize: 'all' | 'small' | 'medium' | 'large';  // <100KB, 100KB-1MB, >1MB
}

class LinkMediaModal extends FuzzySuggestModal<TFile> {
  private filters: MediaPickerFilters = {
    fileType: 'all',
    fileAge: 'all',
    fileSize: 'all'
  };

  getItems(): TFile[] {
    return this.app.vault.getFiles()
      .filter(file => this.matchesFilters(file));
  }

  private matchesFilters(file: TFile): boolean {
    // Type filter
    if (this.filters.fileType !== 'all') {
      const ext = file.extension.toLowerCase();
      if (this.filters.fileType === 'image' && !IMAGE_EXTENSIONS.includes(`.${ext}`)) return false;
      if (this.filters.fileType === 'document' && !DOCUMENT_EXTENSIONS.includes(`.${ext}`)) return false;
      // ... video, audio
    }

    // Age filter
    if (this.filters.fileAge !== 'all') {
      const age = Date.now() - file.stat.mtime;
      if (this.filters.fileAge === 'today' && age > 86400000) return false;
      if (this.filters.fileAge === 'week' && age > 604800000) return false;
      // ... month, year
    }

    // Size filter
    if (this.filters.fileSize !== 'all') {
      const size = file.stat.size;
      if (this.filters.fileSize === 'small' && size >= 100000) return false;
      if (this.filters.fileSize === 'medium' && (size < 100000 || size >= 1000000)) return false;
      if (this.filters.fileSize === 'large' && size < 1000000) return false;
    }

    return true;
  }
}
```

**Entity Type Filter in Gallery:**

```typescript
interface GalleryFilterOptions {
  entityType?: 'person' | 'event' | 'place' | 'organization' | 'source' | 'all';
  sourceType?: string;  // For sources only
  mediaType?: 'image' | 'audio' | 'video' | 'pdf' | 'document' | 'all';
  searchQuery?: string;
}
```

**Media Order Modal (Thumbnail Selection):**

```typescript
/**
 * Modal for reordering media items via drag-and-drop.
 * First item becomes the thumbnail.
 */
class MediaOrderModal extends Modal {
  private entity: { file: TFile; media: string[] };
  private mediaItems: MediaItem[];
  private sortableList: HTMLElement;

  constructor(app: App, private mediaService: MediaService, entity: EntityWithMedia) {
    super(app);
    this.entity = entity;
    this.mediaItems = entity.media.map(ref => mediaService.resolveMediaItem(ref));
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('cr-media-order-modal');

    // Header
    contentEl.createEl('h2', { text: 'Manage media' });
    contentEl.createEl('p', {
      text: 'Drag to reorder. The first item will be used as the thumbnail.',
      cls: 'setting-item-description'
    });

    // Sortable media list
    this.sortableList = contentEl.createDiv({ cls: 'cr-media-order-list' });
    this.renderSortableList();

    // Footer buttons
    const footer = contentEl.createDiv({ cls: 'modal-button-container' });

    const cancelBtn = footer.createEl('button', { text: 'Cancel' });
    cancelBtn.addEventListener('click', () => this.close());

    const saveBtn = footer.createEl('button', { text: 'Save', cls: 'mod-cta' });
    saveBtn.addEventListener('click', () => this.save());
  }

  private renderSortableList(): void {
    this.sortableList.empty();

    for (let i = 0; i < this.mediaItems.length; i++) {
      const item = this.mediaItems[i];
      const row = this.sortableList.createDiv({ cls: 'cr-media-order-item' });
      row.setAttribute('draggable', 'true');
      row.dataset.index = String(i);

      // Drag handle
      const handle = row.createSpan({ cls: 'cr-media-order-handle' });
      setIcon(handle, 'grip-vertical');

      // Thumbnail preview
      if (item.type === 'image' && item.file) {
        const img = row.createEl('img', {
          cls: 'cr-media-order-thumbnail',
          attr: { src: this.app.vault.getResourcePath(item.file) }
        });
      } else {
        const icon = row.createSpan({ cls: 'cr-media-order-icon' });
        setIcon(icon, item.type === 'document' ? 'file-text' : 'file');
      }

      // Filename
      row.createSpan({ text: item.displayName, cls: 'cr-media-order-name' });

      // Thumbnail badge (first item only)
      if (i === 0) {
        row.createSpan({ text: 'Thumbnail', cls: 'cr-media-order-badge' });
      }

      // Delete button
      const deleteBtn = row.createSpan({ cls: 'cr-media-order-delete' });
      setIcon(deleteBtn, 'trash-2');
      deleteBtn.addEventListener('click', () => this.removeItem(i));

      // Drag events
      this.setupDragEvents(row, i);
    }
  }

  private setupDragEvents(row: HTMLElement, index: number): void {
    row.addEventListener('dragstart', (e) => {
      row.addClass('is-dragging');
      e.dataTransfer?.setData('text/plain', String(index));
    });

    row.addEventListener('dragend', () => {
      row.removeClass('is-dragging');
    });

    row.addEventListener('dragover', (e) => {
      e.preventDefault();
      row.addClass('drag-over');
    });

    row.addEventListener('dragleave', () => {
      row.removeClass('drag-over');
    });

    row.addEventListener('drop', (e) => {
      e.preventDefault();
      row.removeClass('drag-over');
      const fromIndex = parseInt(e.dataTransfer?.getData('text/plain') || '0');
      this.moveItem(fromIndex, index);
    });
  }

  private moveItem(fromIndex: number, toIndex: number): void {
    if (fromIndex === toIndex) return;
    const [item] = this.mediaItems.splice(fromIndex, 1);
    this.mediaItems.splice(toIndex, 0, item);
    this.renderSortableList();
  }

  private removeItem(index: number): void {
    this.mediaItems.splice(index, 1);
    this.renderSortableList();
  }

  private async save(): Promise<void> {
    // Convert back to wikilink strings
    const newMediaRefs = this.mediaItems.map(item => item.mediaRef);

    // Update frontmatter with new order
    await this.mediaService.updateMediaOrder(this.entity.file, newMediaRefs);

    new Notice('Media order updated');
    this.close();
  }
}
```

**MediaService.updateMediaOrder():**

```typescript
/**
 * Update frontmatter with new media order.
 * Writes media as YAML array.
 */
async updateMediaOrder(file: TFile, mediaRefs: string[]): Promise<void> {
  await this.app.fileManager.processFrontMatter(file, (fm) => {
    // Write as array (or remove if empty)
    if (mediaRefs.length > 0) {
      fm.media = mediaRefs;
    } else {
      delete fm.media;
    }
  });
}
```

#### Files to Create

| File | Purpose |
|------|---------|
| `src/core/ui/link-media-modal.ts` | Modal for linking media to any entity |
| `src/core/ui/media-order-modal.ts` | Drag-and-drop modal for reordering media (thumbnail selection) |

#### Files to Modify

| File | Changes |
|------|---------|
| `src/context-menu.ts` | Add "Link Media" action for all entity types |
| `src/sources/ui/bulk-media-link-modal.ts` | Add entity type selector |
| `src/sources/ui/media-gallery.ts` | Extend to all entity types |
| `src/ui/control-center.ts` | Add media indicators to entity tables |
| `src/ui/people-tab.ts` | Add media column |
| `src/events/ui/events-tab.ts` | Add media column |
| `src/places/ui/places-tab.ts` | Add media column |
| `src/organizations/ui/organizations-tab.ts` | Add media column |

---

### Phase 3: Family Chart Thumbnails

**Focus:** Display person thumbnails on canvas nodes.

#### Scope

1. **Thumbnail rendering**
   - Display first media item as thumbnail on person nodes
   - Configurable thumbnail size (small, medium, large)
   - Configurable position (top-left, top-right, etc.)

2. **Fallback display**
   - Show initials when no media present
   - Optional: show placeholder icon

3. **Plugin Settings** (in Charted Roots settings tab)
   - Enable/disable thumbnails globally
   - Thumbnail size setting
   - Thumbnail position setting

4. **Performance optimization**
   - Lazy load thumbnails
   - Cache resolved media files
   - Skip thumbnail loading for collapsed nodes

#### Implementation Notes

**Thumbnail Rendering:**

```typescript
// In canvas node rendering
function renderPersonNodeWithThumbnail(
  node: PersonNode,
  ctx: CanvasRenderingContext2D,
  options: ThumbnailOptions
): void {
  const thumbnail = mediaService.getFirstMediaAsThumbnail(node);

  if (thumbnail) {
    // Load and render thumbnail image
    const img = await loadImage(thumbnail);
    const { x, y, size } = calculateThumbnailPosition(node, options);
    ctx.drawImage(img, x, y, size, size);
  } else if (options.showInitials) {
    // Render initials fallback
    renderInitials(node.name, x, y, size);
  }
}
```

**Settings Interface:**

```typescript
interface ThumbnailSettings {
  enabled: boolean;
  size: 'small' | 'medium' | 'large';  // 32px, 48px, 64px
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  showInitialsFallback: boolean;
}
```

#### Files to Modify

| File | Changes |
|------|---------|
| `src/canvas/canvas-renderer.ts` | Add thumbnail rendering |
| `src/canvas/family-chart-view.ts` | Integrate thumbnails |
| `src/settings.ts` | Add thumbnail settings |
| `src/settings/settings-tab.ts` | Add thumbnail settings UI |

---

### Phase 3.5: Media Folder Filter

**Focus:** Allow users to limit media scanning to specific folders.

#### Problem

Users with large vaults often have many unrelated media files (screenshots, app assets, random images). The "Find Unlinked" modal and Media Manager stats include these files, creating noise and making it harder to identify genealogy/worldbuilding media that should be linked.

#### Solution

Add a "Media folders" setting that limits where Charted Roots looks for media files. This affects discovery operations (finding unlinked files, counting vault media) but not operations on already-linked media.

#### Scope

1. **Settings additions**
   - `mediaFolders: string[]` — List of folders to scan for media
   - `enableMediaFolderFilter: boolean` — Toggle to enable/disable the filter

2. **Settings UI** (Preferences > Folder locations)
   - "Media folders" multi-folder selector (same pattern as existing folder settings)
   - "Limit media scanning to specified folders" toggle
   - Help text explaining what's affected

3. **Apply filter to**
   - Find Unlinked modal — Only show orphaned files from media folders
   - Media Manager hub stats — Count only files in media folders
   - MediaPickerModal — Show only files from media folders when linking

4. **Do NOT apply filter to**
   - Browse Gallery — Already shows only linked media
   - Existing linked media references — Links work regardless of filter

#### Implementation Notes

**Settings Interface:**

```typescript
interface CanvasRootsSettings {
  // ... existing settings ...

  /** Folders to scan for media files */
  mediaFolders: string[];

  /** Whether to limit media scanning to specified folders */
  enableMediaFolderFilter: boolean;
}
```

**Default Values:**

```typescript
const DEFAULT_SETTINGS: CanvasRootsSettings = {
  // ... existing defaults ...
  mediaFolders: [],
  enableMediaFolderFilter: false,  // Disabled by default for backwards compatibility
};
```

**Media Folder Filter Service:**

```typescript
/**
 * Check if a file is within the configured media folders.
 * Returns true if:
 * - Filter is disabled (enableMediaFolderFilter === false)
 * - mediaFolders is empty
 * - File path starts with any of the configured folder paths
 */
function isInMediaFolders(filePath: string, settings: CanvasRootsSettings): boolean {
  if (!settings.enableMediaFolderFilter || settings.mediaFolders.length === 0) {
    return true;  // No filtering - accept all files
  }

  return settings.mediaFolders.some(folder => {
    const normalizedFolder = folder.endsWith('/') ? folder : `${folder}/`;
    return filePath.startsWith(normalizedFolder);
  });
}
```

**Settings UI:**

```
┌─────────────────────────────────────────────────────────────┐
│  Media folders                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ + Add folder                                         │    │
│  └─────────────────────────────────────────────────────┘    │
│  media/genealogy                                      [×]    │
│  attachments/family-photos                            [×]    │
│                                                              │
│  ☑ Limit media scanning to specified folders                 │
│    Only show media from these folders in Find Unlinked,      │
│    Media Manager stats, and media picker.                    │
└─────────────────────────────────────────────────────────────┘
```

#### Files to Modify

| File | Changes |
|------|---------|
| `src/settings.ts` | Add `mediaFolders` and `enableMediaFolderFilter` settings |
| `src/settings/preferences-tab.ts` | Add UI in Folder locations section |
| `src/core/ui/unlinked-media-modal.ts` | Filter files by media folders |
| `src/core/ui/media-manager-modal.ts` | Filter stats by media folders |
| `src/core/ui/media-picker-modal.ts` | Filter file list by media folders |

---

### Phase 4: Gramps Package Import ✅

**Focus:** Import `.gpkg` files with bundled media.

**Status:** Complete

#### Implementation Summary

The `.gpkg` import was implemented directly in the existing Gramps import flow, extending the control center to accept `.gpkg` files and extracting media alongside XML parsing.

**Key Discovery:** Gramps exports `.gpkg` files as **gzip-compressed tar archives** (`.tar.gz`), not ZIP files. The implementation supports all three formats:

1. **ZIP archives** — Handled via JSZip library
2. **Gzip-compressed tar archives** — Native tar parser implementation (no external dependency)
3. **Plain gzip-compressed XML** — For exports without bundled media

#### Files Created

| File | Purpose |
|------|---------|
| `src/gramps/gpkg-extractor.ts` | Archive extraction with format detection (ZIP, gzip+tar, gzip) |

#### Files Modified

| File | Changes |
|------|---------|
| `src/gramps/gramps-types.ts` | Added `GrampsMedia` interface, `media` map in `GrampsDatabase` |
| `src/gramps/gramps-parser.ts` | Added `parseMedia()` for `<object>` elements |
| `src/gramps/gramps-importer.ts` | Added `extractMediaToVault()`, media linking to sources |
| `src/ui/control-center.ts` | Accept `.gpkg` files, call extractor, pass media to importer |
| `src/ui/gedcom-import-progress-modal.ts` | Added 'media' phase to import progress |
| `package.json` | Added `jszip` dependency |

#### Archive Format Handling

**gpkg-extractor.ts** detects format via magic bytes:

```typescript
// ZIP: 0x50 0x4B ("PK")
export function isZipFile(data: ArrayBuffer): boolean {
  const view = new Uint8Array(data);
  return view.length >= 2 && view[0] === 0x50 && view[1] === 0x4B;
}

// Gzip: 0x1F 0x8B
export function isGzipFile(data: ArrayBuffer): boolean {
  const view = new Uint8Array(data);
  return view.length >= 2 && view[0] === 0x1f && view[1] === 0x8b;
}

// Tar: "ustar" at offset 257
function isTarFile(data: Uint8Array): boolean {
  if (data.length < 263) return false;
  const magic = String.fromCharCode(data[257], data[258], data[259], data[260], data[261]);
  return magic === 'ustar';
}
```

**Extraction Flow:**

```typescript
export async function extractGpkg(data: ArrayBuffer, filename: string): Promise<GpkgExtractionResult> {
  if (isGzipFile(data)) {
    const decompressed = await decompressGzipToBytes(new Uint8Array(data));

    if (isTarFile(decompressed)) {
      // Gzip-compressed tar archive (most common Gramps format)
      const tarFiles = extractTar(decompressed);
      // Find .gramps/.xml file and extract media files
      return { grampsXml, mediaFiles, filename };
    }

    // Plain gzip-compressed XML (no bundled media)
    return { grampsXml: decode(decompressed), mediaFiles: new Map(), filename };
  }

  if (isZipFile(data)) {
    // ZIP archive via JSZip
    const zip = await JSZip.loadAsync(data);
    // Extract data.gramps and media files
    return { grampsXml, mediaFiles, filename };
  }

  throw new Error('File is not a valid ZIP or gzip archive');
}
```

#### Native Tar Parser

Implemented a minimal tar parser to avoid adding another dependency:

```typescript
function extractTar(data: Uint8Array): Map<string, Uint8Array> {
  const files = new Map<string, Uint8Array>();
  let offset = 0;

  while (offset < data.length - 512) {
    const header = data.slice(offset, offset + 512);
    if (header.every(b => b === 0)) break;  // End of archive

    // Parse filename (bytes 0-99, null-terminated)
    // Parse file size (bytes 124-135, octal)
    // Parse type flag (byte 156)

    offset += 512;  // Move past header

    if (isRegularFile && fileSize > 0) {
      files.set(filename, data.slice(offset, offset + fileSize));
    }

    offset += Math.ceil(fileSize / 512) * 512;  // Move past content (512-byte aligned)
  }

  return files;
}
```

#### Media Linking

Media files from the archive are:

1. Written to the configured media folder in the vault
2. Mapped by Gramps handle to vault path
3. Linked to Source notes via the `media` YAML array property

```typescript
// In gramps-importer.ts
async extractMediaToVault(
  mediaFiles: Map<string, ArrayBuffer>,
  grampsData: GrampsDatabase,
  targetFolder: string
): Promise<Map<string, string>> {
  // Returns: Gramps media handle → vault file path
}

// Source notes get media wikilinks:
// media:
//   - "[[media/imports/photo1.jpg]]"
//   - "[[media/imports/document.pdf]]"
```

#### Future Enhancements

- [ ] Link media to Person notes (currently only Sources)
- [ ] Link media to Event notes
- [ ] Link media to Place notes
- [ ] Configurable media import folder (currently uses first mediaFolders setting)
- [ ] Filename collision handling options
- [ ] Import summary showing linked vs. orphaned media

---

### Phase 5: Dynamic Note Content ✅

**Focus:** Add `canvas-roots-media` code block for inline media display.

**Status:** Complete

#### Implementation Summary

The media gallery dynamic block was implemented using the code block pattern (consistent with `canvas-roots-timeline` and `canvas-roots-relationships`), with freeze-to-markdown support outputting styled callouts.

**Dynamic block syntax:**
```markdown
```canvas-roots-media
columns: 3
size: medium
```
```

**Freeze output:**
```markdown
> [!info|cr-frozen-gallery]
> ![[portrait.jpg]]
> ![[wedding.jpg]]
> ![[birth-cert.pdf]]
```

#### Files Created

| File | Purpose |
|------|---------|
| `src/core/media-block-processor.ts` | Code block processor for `canvas-roots-media` blocks |

#### Files Modified

| File | Changes |
|------|---------|
| `main.ts` | Register media block processor, add media to `insertDynamicBlocks()` command |
| `src/core/person-note-writer.ts` | Add `'media'` to `DynamicBlockType`, insert media block in generated notes |
| `styles/dynamic-content.css` | Frozen gallery callout CSS (MCL Gallery Cards-inspired styling) |
| `styles/style-settings.css` | Style Settings integration for gallery customization |
| `styles/variables.css` | CSS variables for gallery (gap, max-height, max-width, border-radius) |

#### Frozen Gallery Features

Styling inspired by [MCL Gallery Cards](https://github.com/efemkay/obsidian-modular-css-layout) by Faiz Khuzaimah:

- **Flex layout** — Images wrap in responsive grid
- **Image sizing** — Configurable max-height/max-width with object-fit cover
- **Border radius** — Rounded corners on gallery images
- **Hover effects** — Scale transform and accent border on hover
- **Click-to-zoom** — `:active` state expands image to fullscreen overlay
- **Style Settings integration** — Users can customize via Style Settings plugin

#### Style Settings Options

| Setting | Description | Default |
|---------|-------------|---------|
| Gallery gap | Space between images | 5px |
| Image max height | Maximum height for gallery images | 200px |
| Image max width | Maximum width for gallery images | 250px |
| Image border radius | Corner rounding for images | 8px |
| Image fit mode | How images fill their container (cover, contain, fill, none) | cover |
| Gallery background | Background color behind the gallery | transparent |

#### Plugin Settings

| Setting | Description | Default |
|---------|-------------|---------|
| Frozen gallery callout type | Callout type used when freezing galleries | info |

#### Editable Mode

The `editable: true` option enables inline drag-and-drop reordering:

```markdown
```canvas-roots-media
columns: 3
editable: true
```
```

When enabled:
- Items show a drag handle on hover
- Drag items to reorder
- First item becomes the thumbnail
- Frontmatter is updated automatically on drop
- Gallery has dashed border to indicate edit mode

---

## Technical Considerations

### Supported Media Types

Charted Roots supports all file types that Obsidian can embed natively, plus document formats.

**File Type Categories:**

| Category | Extensions | Obsidian Native | Notes |
|----------|------------|-----------------|-------|
| **Image** | `.avif`, `.bmp`, `.gif`, `.jpeg`, `.jpg`, `.png`, `.svg`, `.webp` | Yes | Full thumbnail/lightbox support |
| **Audio** | `.flac`, `.m4a`, `.mp3`, `.ogg`, `.wav`, `.webm`, `.3gp` | Yes | Inline player in gallery |
| **Video** | `.mkv`, `.mov`, `.mp4`, `.ogv`, `.webm` | Yes | Thumbnail frame + inline player |
| **PDF** | `.pdf` | Yes | First page as thumbnail |
| **Document** | `.doc`, `.docx`, `.xls`, `.xlsx`, `.ppt`, `.pptx` | No (icon only) | File icon, opens in external app |

**Type Constants:**

```typescript
const IMAGE_EXTENSIONS = ['.avif', '.bmp', '.gif', '.jpeg', '.jpg', '.png', '.svg', '.webp'];
const AUDIO_EXTENSIONS = ['.flac', '.m4a', '.mp3', '.ogg', '.wav', '.webm', '.3gp'];
const VIDEO_EXTENSIONS = ['.mkv', '.mov', '.mp4', '.ogv', '.webm'];
const PDF_EXTENSIONS = ['.pdf'];
const DOCUMENT_EXTENSIONS = ['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'];

type MediaType = 'image' | 'audio' | 'video' | 'pdf' | 'document' | 'other';
```

**Gallery Display by Type:**

| Type | Thumbnail | Gallery Card | On Click |
|------|-----------|--------------|----------|
| **Image** | Image preview | Image thumbnail | Lightbox viewer |
| **Audio** | Waveform icon | Audio icon + duration | Inline `<audio>` player |
| **Video** | First frame (future) or video icon | Video icon + duration | Inline `<video>` player |
| **PDF** | First page (future) or PDF icon | PDF icon | Open in Obsidian PDF viewer |
| **Document** | File type icon | Document icon | Open in system default app |

**Thumbnail Selection by Type:**

For Family Chart nodes, only certain types make sense as visual thumbnails:

| Type | Can Be Thumbnail? | Display |
|------|-------------------|---------|
| **Image** | Yes | Rendered image |
| **Video** | Yes (future) | First frame, or video icon |
| **Audio** | No | Skip to next media item |
| **PDF** | No | Skip to next media item |
| **Document** | No | Skip to next media item |

Resolution order for thumbnail:
1. If `thumbnail` field is set → use it
2. Scan `media` list for first image or video
3. If no image/video found → show initials/icon fallback

**Inline Playback:**

Audio and video use Obsidian's native embedding, leveraging `<audio>` and `<video>` HTML elements:

```typescript
function renderAudioPlayer(container: HTMLElement, file: TFile, app: App): void {
  const audio = container.createEl('audio', {
    attr: {
      controls: '',
      src: app.vault.getResourcePath(file)
    }
  });
}

function renderVideoPlayer(container: HTMLElement, file: TFile, app: App): void {
  const video = container.createEl('video', {
    attr: {
      controls: '',
      src: app.vault.getResourcePath(file),
      style: 'max-width: 100%; max-height: 400px;'
    }
  });
}
```

**Future Enhancements:**

- Video thumbnail extraction (first frame) — requires canvas manipulation or ffmpeg
- PDF first page thumbnail — requires pdf.js rendering
- Audio waveform visualization — requires Web Audio API

These are deferred to keep initial implementation simple.

---

### Media File Organization

Media files can live anywhere in the vault. Charted Roots links to files but doesn't manage their location—users organize files according to their own preferences.

**Linking Scenarios:**

| Scenario | File Location | Who Decides |
|----------|---------------|-------------|
| Manual linking | Existing file in vault | User (file already exists) |
| Bulk import from folder | Existing files in vault | User (files already exist) |
| Gramps Package import | Configurable destination | User (setting) |
| Future: drag-and-drop | Configurable destination | User (setting) |

**Gramps Package Import Setting:**

When importing `.gpkg` files, extracted media needs a destination folder:

```typescript
interface MediaImportSettings {
  /** Folder for extracted media from imports (relative to vault root) */
  mediaImportFolder: string;  // Default: "media/imports"

  /** How to handle filename collisions */
  collisionHandling: 'rename' | 'skip' | 'overwrite';

  /** Whether to prefix filenames with entity cr_id */
  prefixWithCrId: boolean;  // Default: false
}
```

**Settings UI:**

```
┌─────────────────────────────────────────────────────────────┐
│  Media import folder                                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ media/imports                                        │   │
│  └─────────────────────────────────────────────────────┘   │
│  Folder for media files extracted from Gramps packages.    │
│                                                             │
│  ☐ Prefix filenames with entity ID                         │
│    e.g., john-smith_portrait.jpg                           │
│                                                             │
│  On filename collision:  [Rename with suffix  ▼]           │
└─────────────────────────────────────────────────────────────┘
```

**Recommended Folder Structures:**

Users can organize however they prefer. Common patterns:

```
# By entity type
media/
├── people/
│   ├── john-smith-portrait.jpg
│   └── jane-doe-photo.png
├── places/
│   └── dublin-1920s.jpg
└── events/
    └── wedding-1902.jpg

# By family/project
media/
├── smith-family/
│   ├── john-portrait.jpg
│   └── wedding.jpg
└── imports/
    └── gramps-2024-01/
        ├── photo1.jpg
        └── photo2.jpg

# Flat (simple)
attachments/
├── john-smith.jpg
├── dublin.jpg
└── wedding.jpg
```

**Non-Goals:**

- Charted Roots does not move or copy files on linking (links to existing files)
- Charted Roots does not enforce folder structure
- Charted Roots does not rename files on linking (except during import with prefix option)

---

### YAML Array Convention

The `media` property uses YAML array syntax:

```yaml
media:
  - "[[file1.jpg]]"        # First item = thumbnail
  - "[[file2.jpg]]"
  - "[[file3.pdf]]"
```

This is cleaner than the indexed property pattern (`media_2`, `media_3`) used by existing `source_*` properties. The source properties will be migrated to arrays in a future update (see [source-array-migration.md](./source-array-migration.md)).

### Media Resolution

Media references can be:

1. **Wikilinks:** `[[path/to/file.jpg]]`
2. **Wikilinks with alias:** `[[path/to/file.jpg|Portrait]]`
3. **Plain paths:** `path/to/file.jpg` (for import compatibility)

The `resolveMediaItem()` function handles all formats.

### File Type Detection

Reuse existing constants:

```typescript
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff', '.tif'];
const DOCUMENT_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'];
```

### Performance

For large vaults with many media:

1. **Lazy thumbnail loading** — Only load visible thumbnails
2. **Media index cache** — Cache entity → media mappings
3. **Image resize for thumbnails** — Don't load full-res for tiny thumbnails

#### Implemented Optimizations

**Avatar URL Caching (2025-12-22)**

The Family Chart now caches resolved avatar URLs in a `Map<string, string>` keyed by person crId. This provides:

- **Faster avatar toggle** — When toggling avatars on/off, cached URLs are reused instead of re-resolving from MediaService
- **Faster re-initialization** — Chart re-initializations (e.g., orientation changes) don't need to re-resolve URLs
- **Cache invalidation** — Cache is cleared on `refreshChart()` when vault changes occur

Implementation in `family-chart-view.ts`:
- `avatarUrlCache: Map<string, string>` — Persists across chart re-initializations
- `preResolveAvatars()` — Pre-populates cache before data transformation
- `transformPersonNode()` — Uses cached URLs via simple Map lookup

#### Future Optimizations

**CSS-Based Avatar Toggle (Planned)**

Currently, toggling avatars requires full chart re-initialization because:
1. Avatar URLs are only passed to family-chart when `showAvatars` is true
2. The family-chart library renders SVG cards with or without `<image>` elements based on the `avatar` field

A CSS-based approach would:
1. **Always pass avatar URLs** to the chart data (even when "hidden")
2. **Add a CSS class** to the chart container: `.cr-fcv-avatars-hidden`
3. **Use CSS to hide avatars**: `.cr-fcv-avatars-hidden .card image { display: none; }`
4. **Toggle the class** instead of re-initializing

Benefits:
- Instant avatar toggle (no chart rebuild)
- Smoother user experience
- Preserves zoom/pan state

Challenges:
- Requires investigation of family-chart SVG structure
- May need to modify card rendering to always include `<image>` element
- Need to handle image loading when initially hidden

**SVG Export with Avatars (Improved)**

Exporting large trees with avatars to SVG can be resource-intensive due to base64 encoding of images. Improvements:

1. **Sequential image processing** — Images are now processed one at a time to reduce memory pressure
2. **UI thread yielding** — `setTimeout(50)` after each image for large exports to allow garbage collection
3. **User notification** — Shows notice for exports with 50+ images: "Embedding N images... This may take a moment."
4. **No-avatar export option** — Export menu now includes "Export as SVG (no avatars)" for faster/smaller exports
5. **Depth limit guidance** — Warning for large exports suggests using tree depth limits to reduce visible nodes
6. **Avatar downscaling** — Avatars scaled to 150px max and converted to JPEG (85% quality) to reduce base64 size

**Workaround for large trees (100+ avatars):**

For very large trees where avatar export causes memory exhaustion:

1. **Use tree depth limits** — Click the branch icon in toolbar to limit ancestry/progeny depth (e.g., 3-4 generations)
2. **Export smaller sections** — Navigate to different root people to export focused subtrees
3. **Use no-avatar export** — "Export as SVG (no avatars)" always works regardless of tree size

**Export Modal (Planned)**

Replace the current export dropdown menu with a dedicated Export Modal/Wizard that provides:

1. **Format selection** — PNG, SVG, PDF with visual previews/icons
2. **Avatar options** — Include/exclude avatars with size/quality controls
3. **Scope options** — Export visible tree, full tree, or custom depth limits
4. **Size estimation** — Show estimated file size before export
5. **Progress display** — Real-time progress bar for large exports with cancel option
6. **Presets** — Quick options like "Print quality", "Web sharing", "Compact"

Benefits:
- Better discoverability of export options
- Prevents accidental large exports that may crash
- Allows users to tune quality vs size tradeoffs
- Progress feedback for long-running exports

---

## Success Criteria

### Phase 1
- [x] `media` property parseable on Person, Event, Place, Organization notes
- [x] `MediaService` provides unified media access across entity types
- [x] Property aliases work for all entity types
- [x] Existing Source media functionality continues working

### Phase 2
- [x] "Link Media" context menu action works for all entity types
- [x] "Manage media..." context menu opens reorder modal
- [x] Drag-and-drop reordering updates frontmatter correctly
- [x] First item displays "Thumbnail" badge in reorder UI
- [x] Bulk media linking supports all entity types
- [x] Unified media gallery shows media from all sources
- [x] Media indicators visible in Control Center entity tables
- [x] Media Manager hub with Browse Gallery, Bulk Link, Find Unlinked, Source Media Linker
- [x] Find Unlinked modal discovers orphaned media files

### Phase 3
- [x] Person thumbnails display on Family Chart nodes (avatar field populated from first media)
- [x] Thumbnails are configurable (enable/disable via "Show avatars" menu toggle)
- [x] Fallback to gender icons when no media present (built-in family-chart behavior)
- [x] PNG/SVG/PDF export embeds avatar images as base64 data URIs
- [x] SVG export works with 100+ avatars (downscaled to 150px JPEG, tested with 129 avatars)

### Phase 3.5: Media Folder Filter
- [x] "Media folders" setting added to Preferences > Folder locations
- [x] "Limit media scanning to specified folders" toggle
- [x] Filter applied to Find Unlinked modal
- [x] Filter applied to Media Manager hub stats
- [x] Filter applied to MediaPickerModal
- [x] Backwards compatible (empty folders + disabled = scan entire vault)
- [x] Renamed "Browse Gallery" to "Linked Media Gallery" for UX clarity
- [x] In-modal toggle for filter in Linked Media Gallery (filters to show only linked media within configured folders)
- [x] In-modal toggle for filter in Find Unlinked modal
- [x] Toggle syncs with global setting, disabled when no folders configured

### Phase 4
- [x] `.gpkg` files import correctly (ZIP, gzip+tar, and gzip formats supported)
- [x] Media files extracted to vault (uses first configured media folder)
- [x] Media linked to Source notes via `media` YAML array
- [x] Import progress shows media extraction phase
- [x] Media linking to Person, Event, Place notes

### Phase 5
- [x] `canvas-roots-media` code block processor registered
- [x] Media gallery renders entity's linked media
- [x] `columns` and `size` options supported
- [x] Freeze (❄️) toolbar button converts to `[!info|cr-frozen-gallery]` callout
- [x] Frozen gallery CSS bundled with plugin (MCL Gallery Cards-inspired)
- [x] Style Settings integration for gallery customization
- [x] "Insert Dynamic Blocks" command adds media blocks to existing person notes
- [x] New person notes include media block when dynamic blocks enabled
- [x] Configurable callout type in plugin settings (`frozenGalleryCalloutType`)
- [x] Additional Style Settings options (object-fit, background color)
- [x] `editable` option for inline drag-to-reorder with frontmatter update

---

## Related Documents

- [Source Array Migration](./source-array-migration.md) - Future migration of `source_*` to array format
- [Roadmap: Universal Media Linking](../../wiki-content/Roadmap.md#universal-media-linking)
- [Source Media Gallery](../../wiki-content/Statistics-And-Reports.md#media-gallery)
- [Bulk Source-Image Linking](../../wiki-content/Release-History.md#bulk-source-image-linking-v0125)
- [Gramps Import](../../wiki-content/Import.md#gramps-xml)
