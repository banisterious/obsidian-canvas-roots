# Media Upload and Management Enhancement

**Status:** Planning
**Priority:** High
**Target Version:** TBD
**Created:** 2025-12-29
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

**Destination Folder Logic:**
1. If `enableMediaFolderFilter` is enabled and `mediaFolders` has entries:
   - Default to first configured media folder
   - Allow user to select from configured folders
2. Otherwise:
   - Prompt user for destination folder
   - Remember last-used folder in settings

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
- Destination folder picker
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
│ Destination folder:             │
│ [Canvas Roots/Media       ▼]    │
│                                 │
│ Files to upload:                │
│ • photo.jpg (2.3 MB)      [×]   │
│ • certificate.pdf (0.8 MB) [×]  │
│                                 │
│         [Cancel]  [Upload]      │
└─────────────────────────────────┘
```

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

### Settings Extensions

**Optional new settings:**
```typescript
interface CanvasRootsSettings {
    // ... existing settings

    /** Default upload destination for media files */
    defaultMediaUploadFolder?: string;

    /** Handle file name collisions */
    mediaUploadCollisionBehavior: 'auto-rename' | 'prompt';

    /** Maximum file size for uploads (in MB, 0 = unlimited) */
    maxMediaUploadSize: number;
}
```

---

## User Experience Goals

1. **Streamlined workflow**: Upload and link in one flow, no context switching
2. **Discoverability**: Upload option visible where users expect it
3. **Flexibility**: Support both bulk uploads (Dashboard) and inline uploads (context menu)
4. **Consistency**: Follow established patterns (e.g., PlacePickerModal "Create new" button)
5. **Safety**: Validate file types, handle collisions gracefully

---

## Open Questions

### File Organization
- Should we auto-organize uploads by entity type? (e.g., `Media/People/`, `Media/Events/`)
- Should we support custom folder picker per upload session?

### Entity Linking
- In MediaUploadModal (Dashboard), should entity linking be optional or required?
- Should we support linking uploaded files to multiple entities at once?

### File Type Validation
- Should we enforce media folder filter during upload?
- Should we warn/block uploads of unsupported file types?

### Progress & Feedback
- For large files, show upload progress bar?
- What happens if upload fails (network error, disk full, etc.)?

---

## Implementation Phases

### Phase 1: Dashboard Upload Tile
- New MediaUploadModal
- Add 5th tile to MediaManagerModal
- Basic file upload (single folder, auto-rename collisions)
- No entity linking (just upload to vault)

### Phase 2: Dashboard Layout Expansion
- Add 6th "Link Media" tile
- Reorganize into 3×2 grid
- Rename "Bulk Link Media" to "Bulk Link to Entities"

### Phase 3: Context Menu Enhancement
- Add "Upload files..." button to MediaPickerModal
- Implement inline upload workflow
- Auto-select uploaded files

### Phase 4: Polish & Settings
- Add upload-related settings
- Enhanced collision handling (prompt option)
- File size limits
- Drag-and-drop support

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
