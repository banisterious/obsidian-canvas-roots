# Place Category → Folder Mapping

- **Status:** Planning
- **Related Issue:** [#163](https://github.com/banisterious/obsidian-charted-roots/issues/163)
- **Created:** 2026-01-08

## Problem Statement

Currently, place categories work in one direction only:
- **Folder → Category** (implemented): Folder path determines the default category via configurable rules
- **Category → Folder** (missing): Category selection does NOT determine storage location

Users expect that when they select `place_category: historical`, the place should be stored in `Places/Historical/` subfolder automatically. Currently, all places are stored in the root places folder regardless of category.

### Current Behavior

1. User creates `Places/Historical/` folder
2. User opens Create Place modal from anywhere
3. User sets `place_category: historical`
4. Place is created in base `Places/` folder (wherever modal was opened from)
5. User must manually move file to `Places/Historical/`

### User Confusion Points

1. **Folder rules must be manually configured**: The wiki implies folder → category works automatically, but users must add rules in settings
2. **No reverse mapping**: Setting category doesn't affect storage location
3. **No UI for folder rules**: Must edit JSON settings to configure folder → category rules

## Proposed Solution

Implement automatic category-based subfolder organization with smart defaults and user control.

### Core Feature: Category → Folder Mapping

When creating a place with a specific category, automatically store it in a corresponding subfolder:

```
Places/
  Real/         (place_category: real)
  Historical/   (place_category: historical)
  Disputed/     (place_category: disputed)
  Legendary/    (place_category: legendary)
  Mythological/ (place_category: mythological)
  Fictional/    (place_category: fictional)
```

### Implementation Approach

#### Option A: Automatic Subfolder Creation (Recommended)

**Behavior:**
- When `place_category` is set to non-default value, store in `{placesFolder}/{CategoryName}/`
- Create subfolder automatically if it doesn't exist
- Use capitalized category name (e.g., `historical` → `Historical`)

**Settings:**
```typescript
interface ChartedRootsSettings {
  // Existing
  placesFolder: string;  // e.g., "Charted Roots/Places"

  // New
  useCategorySubfolders: boolean;  // Default: true
  categorySubfolderTemplate: string;  // Default: "{category}" (capitalized)
}
```

**Pros:**
- Intuitive: category selection drives organization
- Minimal configuration required
- Consistent with user expectations

**Cons:**
- May conflict with existing folder structures
- Less flexibility for custom folder names

#### Option B: Configurable Category Mappings

**Behavior:**
- User defines explicit category → folder mappings
- Fall back to base folder if no mapping exists

**Settings:**
```typescript
interface PlaceCategoryFolderRule {
  category: PlaceCategory;
  folder: string;  // Relative to placesFolder
}

interface ChartedRootsSettings {
  placeCategoryFolderRules: PlaceCategoryFolderRule[];
}
```

**Example config:**
```json
{
  "placeCategoryFolderRules": [
    { "category": "historical", "folder": "Historical" },
    { "category": "fictional", "folder": "Fantasy/Fictional" }
  ]
}
```

**Pros:**
- Complete user control
- Supports complex folder structures
- No breaking changes to existing vaults

**Cons:**
- Requires manual configuration
- Empty by default means no automatic organization

#### Option C: Hybrid Approach (Best of Both Worlds)

**Behavior:**
1. Check for category-specific rule first
2. Fall back to automatic `{placesFolder}/{Category}/` if no rule exists
3. Fall back to base `{placesFolder}` if automatic subfolders disabled

**Settings:**
```typescript
interface ChartedRootsSettings {
  // Enable/disable automatic category subfolders
  useCategorySubfolders: boolean;  // Default: true

  // Optional overrides for specific categories
  placeCategoryFolderRules: PlaceCategoryFolderRule[];
}
```

**Pros:**
- Works out of the box with sensible defaults
- Power users can customize
- Backwards compatible (disable for existing vaults)

**Cons:**
- Slightly more complex to implement

### Recommended: Option C (Hybrid)

Best balance of convenience and flexibility.

## Implementation Details

### 1. Add Settings

```typescript
// src/settings.ts
export interface ChartedRootsSettings {
  // ... existing settings

  // Category → Folder mapping
  useCategorySubfolders: boolean;  // Default: true for new installs, false for upgrades
  placeCategoryFolderRules: PlaceCategoryFolderRule[];
}

export interface PlaceCategoryFolderRule {
  category: PlaceCategory;
  folder: string;  // Relative path from placesFolder
}
```

### 2. Add Helper Function

```typescript
// src/settings.ts or new file: src/utils/place-folder-resolver.ts

/**
 * Get the folder path for a place based on its category
 * @param settings - Plugin settings
 * @param category - Place category
 * @returns Full folder path (e.g., "Charted Roots/Places/Historical")
 */
export function getPlaceFolderForCategory(
  settings: ChartedRootsSettings,
  category: PlaceCategory
): string {
  const baseFolder = settings.placesFolder || 'Charted Roots/Places';

  // Check for explicit rule first
  const rule = settings.placeCategoryFolderRules.find(r => r.category === category);
  if (rule) {
    return normalizePath(`${baseFolder}/${rule.folder}`);
  }

  // Fall back to automatic subfolder if enabled
  if (settings.useCategorySubfolders && category !== settings.defaultPlaceCategory) {
    // Capitalize first letter: historical → Historical
    const subfolder = category.charAt(0).toUpperCase() + category.slice(1);
    return normalizePath(`${baseFolder}/${subfolder}`);
  }

  // Fall back to base folder
  return baseFolder;
}
```

### 3. Update CreatePlaceModal

```typescript
// src/ui/create-place-modal.ts

private async createPlace(): Promise<void> {
  // ... validation ...

  // Determine directory based on category
  const targetDirectory = getPlaceFolderForCategory(
    this.settings,
    this.placeData.placeCategory || this.settings.defaultPlaceCategory
  );

  // Create subfolder if it doesn't exist
  if (targetDirectory) {
    const normalizedDir = normalizePath(targetDirectory);
    const folder = this.app.vault.getAbstractFileByPath(normalizedDir);
    if (!folder) {
      await this.app.vault.createFolder(normalizedDir);
    }
  }

  const file = await createPlaceNote(this.app, this.placeData, {
    directory: targetDirectory,
    openAfterCreate: true,
    propertyAliases: this.settings?.propertyAliases || {}
  });

  // ... rest of creation logic ...
}
```

### 4. Update Modal Directory Field

When user manually changes category in the modal, update the directory field to show where it will be saved:

```typescript
// In category dropdown onChange handler
categoryDropdown.onChange(value => {
  this.placeData.placeCategory = value as PlaceCategory;

  // Update directory to match category
  if (this.settings) {
    this.directory = getPlaceFolderForCategory(this.settings, value as PlaceCategory);
    // Update directory input field if visible
    if (this.directoryInputEl) {
      this.directoryInputEl.value = this.directory;
    }
  }
});
```

### 5. Migration Considerations

For existing vaults:
- Default `useCategorySubfolders: false` on upgrade to avoid breaking existing organization
- Default `useCategorySubfolders: true` for new installs
- Provide data quality check: "Places not in category folders" with bulk move option

## UI/UX Improvements

### Settings Tab

Add new section under Places settings:

```
┌─ Place Organization ─────────────────────────────┐
│                                                   │
│ ☑ Use category-based subfolders                  │
│   Automatically organize places into subfolders  │
│   based on their category                        │
│                                                   │
│ Category Folder Overrides:                       │
│ ┌───────────────┬─────────────────────────────┐  │
│ │ Category      │ Subfolder                   │  │
│ ├───────────────┼─────────────────────────────┤  │
│ │ Historical    │ [Historical           ] [×] │  │
│ │ Fictional     │ [Fantasy/Fictional    ] [×] │  │
│ └───────────────┴─────────────────────────────┘  │
│ [+ Add Override]                                  │
│                                                   │
└───────────────────────────────────────────────────┘
```

### Create Place Modal

Show a hint about where the place will be saved:

```
Category: [Historical ▼]
          ↓
          Will be saved to: Places/Historical/
```

## Documentation Updates

### Wiki: Geographic-Features.md

Update the "Place Category Rules" section:

**Before:**
> - Define automatic category assignment based on folder path or collection
> - Example: Places in "Places/Historical" default to `historical` category

**After:**
> **Category-Based Organization:**
> - Places are automatically stored in category-specific subfolders (e.g., `historical` → `Places/Historical/`)
> - Can be disabled in settings for custom organization
>
> **Folder → Category Rules (Optional):**
> - Define custom rules to automatically assign categories based on folder path
> - Example: Places in "Places/Ancient/" default to `historical` category
> - Useful for granular control beyond automatic category folders

## Testing Scenarios

### Create Place Modal
1. **New place with category**: Create place with `historical` category → stored in `Places/Historical/`
2. **Default category**: Create place with default `real` category → stored in `Places/` root
3. **Custom rule**: Configure `fictional` → `Fantasy/Places`, create fictional place → stored correctly
4. **Subfolder creation**: Create place in non-existent category folder → folder created automatically
5. **Feature disabled**: Disable `useCategorySubfolders` → all places go to base folder
6. **Category change in create modal**: Change category → directory field updates to show new location

### Edit Place Modal
7. **Category change with move**: Edit place, change category, click Move → file moves to new folder
8. **Category change without move**: Edit place, change category, click Keep Here → file stays, category updates
9. **Wikilink preservation**: After move, verify wikilinks still resolve correctly

### Import Workflows
10. **GEDCOM import**: Import places → all go to base folder regardless of future category
11. **Post-import organization**: Run "Organize places by category" → places move to category folders
12. **Data Quality check**: After import, DQ shows "Places not in category folders" with count

### Migration
13. **New install**: Fresh vault → `useCategorySubfolders: true` by default
14. **Upgrade with data**: Existing vault with person notes → `useCategorySubfolders: false` by default
15. **Upgrade without data**: Vault with plugin but no data → treated as new install

### Edge Cases
16. **Parent in different folder**: Create fictional child of real parent → child goes to Fictional/ folder
17. **Manual file move**: User moves place file manually → category unchanged, DQ flags mismatch
18. **Missing defaultPlaceCategory**: Settings missing default → falls back to 'real'

## Open Questions (Resolved)

1. **Should we provide bulk migration tool?**
   - **Decision:** Yes. Add command "Organize places by category" to move existing places
   - Include in Data Quality report with "Fix" button

2. **What about parent hierarchy?**
   - **Decision:** Category folder takes precedence over parent location
   - A fictional place should go to `Places/Fictional/` even if its parent is in a different folder
   - Document this clearly in wiki

3. **Should we block cross-category parent-child relationships?**
   - **Decision:** No - categories are metadata, not strict hierarchy rules
   - Warn in Data Quality report if parent/child have mismatched categories

## Additional Considerations

### Import Handling (GEDCOM/Gramps)

**Decision:** Imports should NOT respect category subfolders by default.

**Rationale:**
- Imports create many places at once
- Automatic category detection from folder rules wouldn't work (chicken-and-egg problem)
- Changing import behavior mid-stream could confuse users

**Approach:**
- Import all places to base folder (current behavior preserved)
- Add a Data Quality check: "Places not in category-appropriate folders"
- Provide bulk "Organize places by category" command for post-import cleanup
- Document this workflow in Import-Export wiki

### Category Change Behavior (Edit Place Modal)

**Decision:** Don't auto-move files when category changes. Instead, offer a choice.

**Behavior:**
- When user changes category in Edit Place modal, show a notice:
  - "Category changed to Historical. Move to Places/Historical/?"
  - Buttons: `[Move]` `[Keep Here]`
- For Create Place modal: always use category-based folder (no prompt needed)

**Rationale:**
- Auto-moving is too surprising and may break wikilinks
- User should be in control of file organization
- Create vs Edit have different expectations

### Manual File Moves

**Decision:** Don't auto-update category when user manually moves files.

**Behavior:**
- If user moves a place file to a different folder, category stays unchanged
- Folder → Category rules (if configured) only apply at creation time
- Data Quality can flag "Category doesn't match folder" as informational

**Rationale:**
- Users may have valid reasons for custom organization
- Automatic changes to frontmatter could be disruptive
- Existing folder → category rules already handle this if configured

### Migration Detection (New vs Upgrade)

**Decision:** Use heuristics to detect existing vault.

**Detection logic:**
```typescript
function isExistingVault(app: App, settings: ChartedRootsSettings): boolean {
  // Check for plugin data.json (settings already saved)
  if (settings.peopleFolder !== DEFAULT_SETTINGS.peopleFolder) {
    return true;  // User has customized settings
  }

  // Check for any existing person notes with cr_id
  const files = app.vault.getMarkdownFiles();
  for (const file of files) {
    const cache = app.metadataCache.getFileCache(file);
    if (cache?.frontmatter?.cr_id) {
      return true;  // Found existing data
    }
  }

  return false;  // New install
}
```

**Defaults:**
- New install: `useCategorySubfolders: true`
- Existing vault: `useCategorySubfolders: false`

### Default Category Fallback

**Decision:** Fall back to `'real'` if `defaultPlaceCategory` is not set.

```typescript
const defaultCategory = settings.defaultPlaceCategory || 'real';
```

## Next Steps

1. ✅ Create planning document (this file)
2. ✅ Resolve open questions and edge cases
3. ✅ Get user feedback on proposal
4. Implement Option C (Hybrid approach)
5. Add settings UI for configuration
6. Update Edit Place modal with move prompt
7. Add Data Quality check for misplaced places
8. Add bulk migration command
9. Update documentation (Geographic-Features, Import-Export)
10. Test with existing vaults
