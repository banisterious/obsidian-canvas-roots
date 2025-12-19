# Implementation Details

This document covers technical implementation specifics for Canvas Roots features.

## Table of Contents

- [Context Menu Implementation](#context-menu-implementation)
- [Canvas Generation Implementation](#canvas-generation-implementation)
- [Dual Storage System](#dual-storage-system)
- [Privacy and Gender Identity Protection](#privacy-and-gender-identity-protection)

---

## Context Menu Implementation

### File Menu Integration

The plugin adds context menu items when right-clicking on files. The implementation uses nested submenus on desktop and flat menus on mobile for better UX.

**Basic Pattern in main.ts:**

```typescript
this.registerEvent(
  this.app.workspace.on('file-menu', (menu, file) => {
    // Desktop: use nested submenus; Mobile: use flat menu with prefixes
    const useSubmenu = Platform.isDesktop && !Platform.isMobile;

    if (file instanceof TFile && file.extension === 'md') {
      const cache = this.app.metadataCache.getFileCache(file);
      const hasCrId = !!cache?.frontmatter?.cr_id;

      if (hasCrId) {
        menu.addSeparator();

        if (useSubmenu) {
          menu.addItem((item) => {
            const submenu: Menu = item
              .setTitle('Canvas Roots')
              .setIcon('git-fork')
              .setSubmenu();

            // Add submenu items...
            submenu.addItem((subItem) => {
              subItem
                .setTitle('Generate Canvas tree')
                .setIcon('layout')
                .onClick(() => {
                  const modal = new ControlCenterModal(this.app, this);
                  modal.openWithPerson(file);
                });
            });
          });
        } else {
          // Mobile: flat menu with prefix
          menu.addItem((item) => {
            item
              .setTitle('Canvas Roots: Generate family tree')
              .setIcon('git-fork')
              .onClick(() => {
                const modal = new ControlCenterModal(this.app, this);
                modal.openWithPerson(file);
              });
          });
        }
      }
    }
  })
);
```

**ControlCenterModal.openWithPerson() in control-center.ts:**

```typescript
public openWithPerson(file: TFile): void {
  const cache = this.app.metadataCache.getFileCache(file);
  if (!cache?.frontmatter?.cr_id) {
    new Notice('This note does not have a cr_id field');
    return;
  }

  const crId = cache.frontmatter.cr_id;
  const name = cache.frontmatter.name || file.basename;

  // Store person info for the tab to use when it renders
  this.pendingRootPerson = {
    name,
    crId,
    birthDate: cache.frontmatter.born,
    deathDate: cache.frontmatter.died,
    file
  };

  // Open to Tree Output tab (combines open + tab switch)
  this.openToTab('tree-generation');
}
```

**Note:** The actual implementation in main.ts is more comprehensive, with separate handling for:
- Canvas files (regenerate, export, statistics)
- Person notes (generate tree, add relationships, reference numbers)
- Place notes (geocode, view on map)
- Source/Event/Organization notes
- Schema notes
- Folders (import/export, statistics)

---

## Canvas Generation Implementation

### Canvas Node ID Format

Canvas nodes require alphanumeric IDs without special characters (dashes, underscores, etc.). The plugin generates these using `Math.random().toString(36)`:

```typescript
// Good: alphanumeric only
"6qi8mqi3quaufgk0imt33f"

// Bad: contains dashes (not movable in Obsidian)
"qjk-453-lms-042"
```

**Implementation:** The canvas generator maintains a mapping from `cr_id` (person identifier) to `canvasId` (canvas node identifier) to ensure edges connect correctly while using Obsidian-compatible IDs.

### Canvas JSON Format

Obsidian Canvas requires a specific JSON format:

1. **Tab indentation** (`\t`) for structure
2. **Compact objects** - each node/edge on a single line with no spaces after colons/commas
3. **Required metadata** - version and frontmatter fields

Example:
```json
{
	"nodes":[
		{"id":"abc123","type":"file","file":"Person.md","x":0,"y":0,"width":250,"height":120}
	],
	"edges":[],
	"metadata":{
		"version":"1.0-1.0",
		"frontmatter":{}
	}
}
```

**Implementation:** Custom `formatCanvasJson()` method in `control-center.ts` ensures exact format match.

### Known Issues & Solutions

#### Issue: Canvas nodes not movable/resizable
**Cause:** Canvas node IDs contained dashes (e.g., `qjk-453-lms-042`)
**Solution:** Generate alphanumeric-only IDs matching Obsidian's format
**Fixed in:** `canvas-generator.ts` - `generateNodeId()` method

#### Issue: Canvas cleared on close/reopen
**Cause:** JSON formatting didn't match Obsidian's exact requirements
**Solution:** Implement custom JSON formatter with tabs and compact objects
**Fixed in:** `control-center.ts` - `formatCanvasJson()` method

#### Issue: Race condition when opening canvas
**Cause:** Canvas opened before file system write completed
**Solution:** Add 100ms delay before opening canvas file
**Fixed in:** `control-center.ts` and `main.ts` - canvas opening logic

#### Issue: GEDCOM import only shows root person in tree
**Cause:** GEDCOM importer's second pass replaced IDs in wrong fields (father/mother/spouse instead of father_id/mother_id/spouse_id)
**Solution:** Update regex patterns to target correct _id fields with dual storage
**Fixed in:** `gedcom-importer.ts` - Phase 2 ID replacement logic

---

## Dual Storage System

The plugin implements a **dual storage pattern** for relationships to balance Obsidian features with reliable resolution:

### Frontmatter Structure

```yaml
---
cr_id: abc-123-def-456
name: John Smith
father: "[[Dad Smith]]"      # Wikilink (enables Obsidian features)
father_id: xyz-789-uvw-012   # cr_id (enables reliable resolution)
mother: "[[Mom Smith]]"
mother_id: pqr-345-stu-678
spouse:
  - "[[Jane Doe]]"
spouse_id:
  - mno-901-jkl-234
children:
  - "[[Child 1]]"
  - "[[Child 2]]"
children_id:
  - def-456-ghi-789
  - abc-123-xyz-456
---
```

### Benefits

1. **Wikilinks** (father/mother/spouse/children): Enable Obsidian's link graph, backlinks, and hover previews
2. **ID fields** (_id suffix): Provide reliable resolution that survives file renames

### Implementation

- **bidirectional-linker.ts**: Creates/updates both wikilink and _id fields when syncing relationships
- **family-graph.ts**: Reads from _id fields first, falls back to wikilink resolution for legacy support
- **gedcom-importer.ts**: Two-pass import: creates wikilinks in first pass, replaces with cr_ids in _id fields in second pass

---

## Privacy and Gender Identity Protection

**Enhanced:** Data model to support inclusive gender identity and privacy protection.

### Implemented Features

- **Gender vs Sex Separation:**
  - `sex`: GEDCOM-compatible biological sex field (M/F/U) for data interchange
  - `gender`: Free-form gender identity field (e.g., "Woman", "Non-binary", "Transgender man")
  - `pronouns`: Optional preferred pronouns (e.g., "she/her", "they/them", "he/him")
- **Deadname Protection:**
  - `name` field always represents current, chosen name
  - `_previous_names` array for historical names (underscore = private/sensitive)
  - Plugin will never display underscore-prefixed fields in UI or search
  - Export warnings when private fields are included
- **Privacy Field Convention:**
  - Any field with underscore prefix (`_`) is private/sensitive
  - Excluded from person picker, search results, canvas labels
  - Requires explicit confirmation for exports
  - Examples: `_previous_names`, `_medical_notes`, `_adoption_details`
- **Inclusive Language:**
  - All documentation and UI uses respectful, inclusive language
  - Designed to serve all users regardless of gender identity or family structure

### Rationale

- Respects transgender and non-binary individuals' dignity
- Separates GEDCOM biological data from personal identity
- Protects sensitive historical information
- Aligns with LGBTQIA+ ally values and inclusive design principles
