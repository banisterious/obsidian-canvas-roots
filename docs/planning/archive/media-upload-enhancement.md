# Media Upload and Management Enhancement

**Status:** ✅ Completed
**Priority:** High
**Target Version:** 0.18.6
**Created:** 2025-12-29
**Completed:** 2025-12-29
**GitHub Issue:** [#60](https://github.com/banisterious/obsidian-canvas-roots/issues/60)

---

## Overview

Add file upload capability to Canvas Roots media management system, allowing users to upload media files directly to their vault and link them to entities without manual file management.

## User Request

User reported inability to link media files (birth certificates, pictures) to person notes. Investigation revealed that while Canvas Roots has robust media *linking* capabilities, it lacks file *upload* functionality. Users must manually add files to their vault before linking them.

**GitHub Issue:** [#60 - [Feature] Enable direct media file upload in media picker](https://github.com/banisterious/obsidian-canvas-roots/issues/60)

---

## Current Architecture

### Media Modals

1. **MediaPickerModal** (`src/core/ui/media-picker-modal.ts`)
   - Grid view for selecting existing vault files
   - Features: search, filter by type, multi-select
   - Entry point: Context menu → "Link media..."

2. **MediaManageModal** (`src/core/ui/media-manage-modal.ts`)
   - List view for reordering/removing linked media
   - Features: drag-and-drop, thumbnail badge
   - "Add media" button opens MediaPickerModal
   - Entry point: Context menu → "Manage media..."

3. **MediaManagerModal** (`src/core/ui/media-manager-modal.ts`)
   - Dashboard hub for vault-wide media operations
   - 4 tiles (currently): Linked Gallery, Bulk Link, Find Unlinked, Source Linker
   - Entry point: Dashboard → Media tile

### Context Menu Entry Points

Media submenu appears on right-click for:
- Person notes (main.ts lines ~2152, 2162, 2563, 2573)
- Place notes (main.ts lines ~1423, 1433, 1556, 1566)
- Event notes (main.ts lines ~2804, 2814, 2893, 2903)

### Media Service

**MediaService** (`src/core/media-service.ts`)
- Core operations: parse, resolve, update media references
- Media stored as YAML array of wikilinks in `media` property
- First item = thumbnail
- Supports: images, video, audio, PDF, documents

### Settings

- `settings.enableMediaFolderFilter` - Toggle for media folder filtering
- `settings.mediaFolders` - Array of folder paths for media files
- `settings.mapsFolder` - Folder for custom map images (separate from media)

---

## Proposed Solution

### Phase 1: Dashboard Enhancement (6-Tile Layout)

Expand Media Manager modal from 4 tiles to 6 tiles in 3×2 grid:

#### Row 1: Browse & Discover
1. **Linked Media Gallery** (existing)
   - View all linked media, filter by entity type
   - Icon: `layout-grid`
   - Current implementation: MediaGalleryModal

2. **Find Unlinked** (existing)
   - Discover orphaned media files
   - Icon: `unlink`
   - Current implementation: UnlinkedMediaModal

3. **Source Media Linker** (existing)
   - Smart filename-based source matching
   - Icon: `file-image`
   - Current implementation: SourceMediaLinkerModal

#### Row 2: Add & Link Operations
4. **Upload Media** (new)
   - Upload new files to vault with optional linking
   - Icon: `upload` or `file-plus-2`
   - Implementation: New MediaUploadModal

5. **Link Media** (new)
   - Pick media files → pick entities → link
   - Icon: `link` or `image-plus`
   - Implementation: Enhanced MediaPickerModal with entity picker

6. **Bulk Link to Entities** (existing, renamed)
   - Pick entities → pick media → link
   - Icon: `layers` or `users`
   - Current: BulkMediaLinkModal (rename from "Bulk Link Media")

**Design rationale:**
- Top row: Discovery/read-only operations
- Bottom row: Write operations that modify links
- 3-column layout provides visual balance

### Phase 2: Context Menu Enhancement

Add inline upload capability to MediaPickerModal when opened from context menu:

**Enhancement approach:**
- Add "Upload files..." button at top (similar to PlacePickerModal's "Create new place")
- After upload, automatically select newly uploaded files
- Maintains existing selection workflow

**User flow:**
1. Right-click person note
2. Media → "Link media..."
3. Click "Upload files..." button
4. Select files from computer
5. Files uploaded to vault (respecting media folder settings)
6. Newly uploaded files automatically selected in picker
7. Click to link to current entity

---

## Implementation Details

### File Upload Mechanism

**Obsidian Vault API:**
```typescript
// For binary files (images, PDFs, etc.)
await this.app.vault.createBinary(path: string, data: ArrayBuffer): Promise<TFile>

// File input in modal
const input = document.createElement('input');
input.type = 'file';
input.multiple = true;
input.accept = 'image/*,video/*,audio/*,.pdf,.doc,.docx';
```

**Destination Folder Logic ("Read Many, Write One"):**

Files always upload to `mediaFolders[0]` (first folder in array), while MediaPickerModal shows files from ALL folders in `mediaFolders[]`.

**Rationale:**
- Simplifies UX (no dropdown needed)
- Predictable behavior (first folder = upload bucket)
- Users can reorganize files later via Obsidian's file explorer
- Clearer mental model: "Browse everywhere, upload to one place"

**Edge cases:**
1. If `mediaFolders` is empty → Prompt user to configure media folder first
2. If `enableMediaFolderFilter` is false → Show warning or use vault root
3. If first folder doesn't exist → Create automatically or show error

**Media vs. Maps separation:**
- Media folders: Entity media linking (people, places, events)
- Maps folder: Custom place map images (separate workflow via place map picker)
- Upload modal only writes to media folders, never maps folder

**File Naming/Collision Handling:**
- Check if file exists: `app.vault.getAbstractFileByPath()`
- If collision detected:
  - Option 1: Auto-append number (e.g., `photo.jpg` → `photo 1.jpg`)
  - Option 2: Prompt user to rename or overwrite
  - Recommended: Option 1 for smoother UX

### MediaUploadModal (New)

**Features:**
- Drag-and-drop zone for file upload
- Browse files button
- Multiple file selection
- File type validation (check against supported extensions)
- Destination folder display (read-only, shows first media folder)
- Optional: immediate entity linking after upload
- Progress indicator for large files

**UI Structure:**
```
┌─────────────────────────────────┐
│ Upload Media Files              │
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │  Drag files here or click   │ │
│ │  [Browse Files]             │ │
│ └─────────────────────────────┘ │
│                                 │
│ Files will be uploaded to:      │
│ Canvas Roots/Media              │
│ (You can move files later)      │
│                                 │
│ Files to upload:                │
│ • photo.jpg (2.3 MB)      [×]   │
│ • certificate.pdf (0.8 MB) [×]  │
│                                 │
│         [Cancel]  [Upload]      │
└─────────────────────────────────┘
```

See mockups at `docs/mockups/media-upload-simple.html` and `docs/mockups/media-upload-modal.html`

### Enhanced MediaPickerModal

**New "Upload files..." button:**
```typescript
// Add at top of modal, similar to PlacePickerModal pattern
const uploadBtn = searchSection.createEl('button', {
    cls: 'crc-btn crc-btn--secondary crc-picker-upload-btn'
});
const uploadIcon = createLucideIcon('upload', 16);
uploadBtn.appendChild(uploadIcon);
uploadBtn.appendText(' Upload files...');

uploadBtn.addEventListener('click', () => {
    this.openUploadDialog();
});
```

**Upload workflow:**
1. Open file input dialog
2. User selects files
3. Upload files to configured media folder
4. Refresh file list
5. Auto-select newly uploaded files
6. User proceeds with normal linking flow

### Settings Enhancements

**Media Folder Reordering (Priority Enhancement)**

Currently, users must delete and re-add media folders to change their order. Since `mediaFolders[0]` determines upload destination, reordering is essential.

**Implementation:**
- Add drag-and-drop handles to media folder list in Preferences
- Enable drag-and-drop reordering using HTML5 Drag API
- Update `mediaFolders` array and save on drop
- Visual feedback during drag operation

**Location:** `src/ui/preferences-tab.ts`, function `renderMediaFoldersList()` (lines 849-918)

**Example code:**
```typescript
// Add drag handle
const dragHandle = folderItem.createDiv({ cls: 'cr-drag-handle' });
const gripIcon = createLucideIcon('grip-vertical', 14);
dragHandle.appendChild(gripIcon);

// Make draggable
folderItem.setAttribute('draggable', 'true');
folderItem.addEventListener('dragstart', (e) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
});

folderItem.addEventListener('drop', async (e) => {
    e.preventDefault();
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
    const toIndex = index;

    // Reorder array
    const item = plugin.settings.mediaFolders.splice(fromIndex, 1)[0];
    plugin.settings.mediaFolders.splice(toIndex, 0, item);
    await plugin.saveSettings();

    // Re-render
    renderMediaFoldersList(container, plugin);
});
```

**Future Optional Settings:**
```typescript
interface CanvasRootsSettings {
    // ... existing settings

    /** Handle file name collisions */
    mediaUploadCollisionBehavior: 'auto-rename' | 'prompt';

    /** Maximum file size for uploads (in MB, 0 = unlimited) */
    maxMediaUploadSize: number;
}
```

Note: No need for `defaultMediaUploadFolder` - always use `mediaFolders[0]`

---

## User Experience Goals

1. **Streamlined workflow**: Upload and link in one flow, no context switching
2. **Discoverability**: Upload option visible where users expect it
3. **Flexibility**: Support both bulk uploads (Dashboard) and inline uploads (context menu)
4. **Consistency**: Follow established patterns (e.g., PlacePickerModal "Create new" button)
5. **Safety**: Validate file types, handle collisions gracefully

---

## Resolved Design Decisions

### File Organization
- **Decision:** Files always upload to `mediaFolders[0]`
- **Rationale:** Simplified "read many, write one" model; users can reorganize later
- **Requirement:** Add drag-and-drop reordering to media folders settings

### Media vs. Maps Separation
- **Decision:** Keep separate (Option A)
- Media folders: Entity media linking (people, places, events)
- Maps folder: Custom place map images via place map picker
- Upload modal never writes to maps folder

### Modal Architecture
- **Decision:** Expand existing MediaPickerModal instead of new separate upload modal
- Follows PlacePickerModal pattern (inline "Create new" button)
- Same modal serves both context menu (entity-first) and Dashboard (media-first) workflows

### Destination Picker
- **Decision:** No dropdown - show read-only destination info instead
- Clearer UX, predictable behavior
- Users reorganize files via Obsidian's file explorer if needed

## Open Questions

### File Type Validation
- Should we warn/block uploads of unsupported file types?
- Recommended: Validate and show error message

### Progress & Feedback
- For large files, show upload progress bar?
- What happens if upload fails (network error, disk full, etc.)?
- Recommended: Progress indicator + error handling with retry option

### Collision Behavior
- Auto-rename with number suffix (e.g., `photo.jpg` → `photo 1.jpg`)?
- Or prompt user for action?
- Recommended: Auto-rename for MVP, add prompt option later

---

## Implementation Phases

### Phase 1: Settings Enhancement (Foundation) ✅
**Status:** Completed
- ✅ Add drag-and-drop reordering to media folders list in Preferences
- ✅ Location: `src/ui/preferences-tab.ts`, `renderMediaFoldersList()` function
- ✅ Allows users to set upload destination by reordering folders
- **Files modified:** `src/ui/preferences-tab.ts`, `styles/preferences.css`

### Phase 2: Dashboard Layout Expansion ✅
**Status:** Completed
- ✅ Expand MediaManagerModal from 4 to 6 tiles (3×2 grid)
- ✅ Add "Upload Media" tile (opens simple standalone upload modal)
- ✅ Add "Link Media" tile (opens MediaPickerModal in media-first mode)
- ✅ Rename "Bulk Link Media" to "Bulk Link to Entities"
- **Files modified:** `src/core/ui/media-manager-modal.ts`, `styles/control-center.css`

### Phase 3: Simple Upload Modal (Dashboard) ✅
**Status:** Completed
- ✅ Create lightweight MediaUploadModal
- ✅ Drag-and-drop zone + browse button
- ✅ Upload to `mediaFolders[0]` with read-only destination display
- ✅ Optional entity linking after upload
- ✅ Auto-rename collision handling (incremental numbering)
- ✅ File type validation
- **Files created:** `src/core/ui/media-upload-modal.ts`
- **Files modified:** `styles/media-modals.css`

### Phase 4: Enhanced MediaPickerModal (Context Menu) ✅
**Status:** Completed
- ✅ Add "Upload files..." button at top (like PlacePickerModal pattern)
- ✅ Inline upload workflow implemented
- ✅ Auto-select newly uploaded files in grid
- ✅ Serves both context menu (entity pre-selected) and Dashboard "Link Media" tile
- ✅ Create EntityPickerModal for media-first workflow
- ✅ Add person-specific filters and sorting to EntityPickerModal
- ✅ Enable upload button in context menu flow
- **Files created:** `src/core/ui/entity-picker-modal.ts`
- **Files modified:** `src/core/ui/media-picker-modal.ts`, `main.ts`, `styles/media-modals.css`

### Phase 5: Polish & Advanced Features ⏭️
**Status:** Deferred to future release
- ⏭️ Progress indicators for large uploads
- ⏭️ Enhanced error handling with retry
- ⏭️ Optional: Prompt-based collision handling (vs. auto-rename)
- ⏭️ Optional: File size limits setting
- ⏭️ Documentation and user guidance

---

## Implementation Summary

**Total commits:** 5
**Files created:** 2
- `src/core/ui/media-upload-modal.ts` (302 lines)
- `src/core/ui/entity-picker-modal.ts` (608 lines)

**Files modified:** 6
- `src/ui/preferences-tab.ts` (drag-and-drop reordering)
- `src/core/ui/media-manager-modal.ts` (6-tile layout)
- `src/core/ui/media-picker-modal.ts` (inline upload button)
- `main.ts` (context menu upload support)
- `styles/preferences.css` (folder reordering styles)
- `styles/media-modals.css` (upload and entity picker styles)

**Key Features Delivered:**
1. **Media folder reordering** - Drag-and-drop interface in settings
2. **6-tile Media Manager** - Expanded dashboard with clear workflow separation
3. **Standalone upload** - MediaUploadModal for bulk file uploads
4. **Inline upload** - "Upload files..." button in MediaPickerModal
5. **Entity picker** - Full entity selection with person filters/sorting
6. **Consistent upload** - Available in both media-first and entity-first workflows

---

## Related Files

- `src/core/ui/media-manager-modal.ts` - Dashboard hub
- `src/core/ui/media-picker-modal.ts` - File selection modal
- `src/core/ui/media-manage-modal.ts` - Reorder/remove modal
- `src/core/media-service.ts` - Core media operations
- `main.ts` - Context menu entry points (lines ~1423, 2152, 2804)
- `src/settings.ts` - Settings interface

---

## Success Metrics

- Users can upload media files without leaving Obsidian
- Upload workflow feels natural and discoverable
- No increase in support requests about media linking
- Positive user feedback on GitHub issue

---

## Notes

- User's original issue: "Can't link the Birth Certificate or picture" - suggests single-entity workflow (context menu)
- Pattern precedent: PlacePickerModal "Create new place" button (lines 217-226 in place-picker.ts)
- Media Manager already has comprehensive vault-wide operations; upload fits naturally there
- Context menu enhancement addresses immediate user pain point
