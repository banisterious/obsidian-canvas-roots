# Unified Property Configuration - Implementation Plan

## Overview

A comprehensive property and value alias configuration UI providing a single source of truth for all mappings. Replaces the current modal-based alias configuration with an Obsidian-native settings interface showing all available properties and their aliases.

## Motivation

**User feedback:** Negative feedback about the current implementation indicates the need for better discoverability and usability.

**Current pain points:**
- Property aliases scattered, requiring users to know canonical names before creating aliases
- No visibility into which properties support aliasing
- Discovering available properties requires reading documentation
- Modal-based workflow adds friction

**Solution:** A unified settings-style view showing all ~80 properties across all entity types, with inline text fields for configuring aliases. Users can browse, search, and configure without leaving the card.

## Goals

1. **Discoverability**: Show ALL properties that can be aliased, not just configured ones
2. **Consistency**: Match Obsidian's native settings UI patterns
3. **Efficiency**: Inline editing with auto-save, no modals
4. **Organization**: Group by entity type with collapsible sections
5. **Search**: Quick filter to find specific properties
6. **Comprehensive**: Include property aliases AND value aliases in one location

## User Stories

### As a genealogist
- I want to see all available person properties so I can choose which to alias
- I want to search for "birth" and see birth_place, born, etc.
- I want to configure aliases without opening multiple modals

### As a worldbuilder
- I want to see event and organization properties in separate collapsible sections
- I want to configure custom event type values below property aliases
- I want a unified view of all my customizations

### As a new user
- I want to browse available properties to understand what Canvas Roots supports
- I want clear descriptions of what each property does
- I want to configure everything in one place without hunting through menus

## Design

### UI Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Property and value configuration                       [?]  │
│ Configure custom property names and values                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Map your custom property names and values to Canvas Roots  │
│ fields. Your frontmatter stays unchanged.                   │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 🔍 Search properties...                                 │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ▼ Person properties (47)                                   │
│   ┌───────────────────────────────────────────────────────┐ │
│   │ Name                                                  │ │
│   │ The person's full name                                │ │
│   │ ┌─────────────────────────────────────────────────┐ │ │
│   │ │ name                                        [x] │ │ │
│   │ └─────────────────────────────────────────────────┘ │ │
│   │                                                       │ │
│   │ Birth date                                            │ │
│   │ Date when the person was born                         │ │
│   │ ┌─────────────────────────────────────────────────┐ │ │
│   │ │ birthdate                                   [x] │ │ │ ← has alias
│   │ └─────────────────────────────────────────────────┘ │ │
│   │                                                       │ │
│   │ Death date                                            │ │
│   │ Date when the person died                             │ │
│   │ ┌─────────────────────────────────────────────────┐ │ │
│   │ │ died                                        [x] │ │ │
│   │ └─────────────────────────────────────────────────┘ │ │
│   │                                                       │ │
│   │ ... (44 more properties)                              │ │
│   └───────────────────────────────────────────────────────┘ │
│                                                             │
│ ▶ Event properties (24)                                    │ ← collapsed
│                                                             │
│ ▶ Place properties (8)                                     │ ← collapsed
│                                                             │
│ ▶ Source properties (TBD)                                  │ ← collapsed
│                                                             │
│ ▶ Organization properties (TBD)                            │ ← collapsed
│                                                             │
│ ─────────────────────────────────────────────────────────── │
│                                                             │
│ ▼ Property values                                          │
│                                                             │
│   Event type values                                        │
│   Custom terminology for event types                       │
│   ┌────────────┬─────────────┬──────────────┬───────┐      │
│   │ Your value │ Maps to     │ Field        │       │      │
│   ├────────────┼─────────────┼──────────────┼───────┤      │
│   │ nameday    │ birth       │ Event type   │ ✎ 🗑 │      │
│   │ coronation │ custom      │ Event type   │ ✎ 🗑 │      │
│   └────────────┴─────────────┴──────────────┴───────┘      │
│   [+ Add value alias]                                      │
│                                                             │
│   Sex values                                               │
│   Custom terminology for sex field                         │
│   (similar table as above)                                 │
│                                                             │
│   Place category values                                    │
│   Custom terminology for place categories                  │
│   (similar table as above)                                 │
│                                                             │
│   Note type values                                         │
│   Custom terminology for cr_type field                     │
│   (similar table as above)                                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Property Configuration Components

Each property uses Obsidian's native `Setting` component:

```typescript
new Setting(sectionContent)
  .setName('Birth date')                      // Human-readable name
  .setDesc('Date when the person was born')   // Description
  .addText(text => text
    .setPlaceholder('born')                   // Shows canonical name
    .setValue(currentAlias)                   // Current alias or empty
    .onChange(async (value) => {
      // Auto-save on change
      if (value.trim() === '') {
        // Remove alias (use canonical)
        await propertyAliasService.removeAlias(canonicalProperty);
      } else {
        // Set alias
        await propertyAliasService.setAlias(value, canonicalProperty);
      }
    })
  )
  .addExtraButton(button => button
    .setIcon('x')
    .setTooltip('Clear alias')
    .onClick(async () => {
      await propertyAliasService.removeAlias(canonicalProperty);
      // Refresh UI
    })
  );
```

### Collapsible Sections

Use `<details>` elements for collapsibility:

```typescript
const section = content.createEl('details', {
  cls: 'cr-property-section',
  attr: { open: '' }  // Person section open by default
});

const summary = section.createEl('summary', {
  cls: 'cr-property-section-summary'
});

const titleSpan = summary.createSpan({
  text: 'Person properties',
  cls: 'cr-property-section-title'
});

const countSpan = summary.createSpan({
  text: '(47)',
  cls: 'cr-property-section-count'
});

const sectionContent = section.createDiv({
  cls: 'cr-property-section-content'
});

// Add Setting components to sectionContent
```

### Search/Filter

```typescript
const searchContainer = content.createDiv({ cls: 'cr-property-search' });

new Setting(searchContainer)
  .addSearch(search => search
    .setPlaceholder('Search properties...')
    .onChange(debounce((query) => {
      filterProperties(query);
    }, 300))
  );

function filterProperties(query: string): void {
  const normalized = query.toLowerCase().trim();

  // For each property Setting element
  for (const setting of propertySettings) {
    const name = setting.nameEl.textContent.toLowerCase();
    const desc = setting.descEl.textContent.toLowerCase();
    const canonical = setting.canonicalName.toLowerCase();

    const matches = name.includes(normalized) ||
                    desc.includes(normalized) ||
                    canonical.includes(normalized);

    setting.settingEl.style.display = matches ? '' : 'none';
  }

  // Update section visibility and counts
  updateSectionVisibility();
}
```

## Architecture

### File Structure

```
src/
├── core/
│   ├── property-alias-service.ts        [existing - update]
│   └── value-alias-service.ts           [existing - no changes]
├── ui/
│   ├── preferences-tab.ts               [modify - new unified card]
│   └── modals/
│       ├── property-alias-modal.ts      [remove - no longer needed]
│       └── value-alias-modal.ts         [keep - still used for values]
styles/
└── preferences.css                       [modify - new styles]
docs/
└── planning/
    └── unified-property-config.md       [this file]
```

### Data Structures

#### Property Metadata

```typescript
interface PropertyMetadata {
  canonical: string;        // e.g., 'born'
  label: string;            // e.g., 'Birth date'
  description: string;      // e.g., 'Date when the person was born'
  category: 'person' | 'event' | 'place' | 'source' | 'organization';
  aliases?: string[];       // Common alternatives for search
}

const PERSON_PROPERTY_METADATA: PropertyMetadata[] = [
  {
    canonical: 'name',
    label: 'Name',
    description: 'The person\'s full name',
    category: 'person',
    aliases: ['full_name', 'display_name']
  },
  {
    canonical: 'born',
    label: 'Birth date',
    description: 'Date when the person was born',
    category: 'person',
    aliases: ['birthdate', 'birth_date', 'dob', 'date_of_birth']
  },
  {
    canonical: 'died',
    label: 'Death date',
    description: 'Date when the person died',
    category: 'person',
    aliases: ['deathdate', 'death_date', 'dod', 'date_of_death']
  },
  // ... 44 more
];

const EVENT_PROPERTY_METADATA: PropertyMetadata[] = [
  {
    canonical: 'event_type',
    label: 'Event type',
    description: 'The type of event (birth, death, marriage, etc.)',
    category: 'event'
  },
  {
    canonical: 'date',
    label: 'Event date',
    description: 'When the event occurred',
    category: 'event',
    aliases: ['event_date', 'occurred']
  },
  // ... 22 more
];

// Similar for PLACE_PROPERTY_METADATA, etc.
```

### Service Updates

#### PropertyAliasService

```typescript
// Add to src/core/property-alias-service.ts

/**
 * Get metadata for a canonical property
 */
getMetadata(canonicalProperty: string): PropertyMetadata | undefined {
  return ALL_PROPERTY_METADATA.find(m => m.canonical === canonicalProperty);
}

/**
 * Get all properties for a category
 */
getPropertiesByCategory(category: string): PropertyMetadata[] {
  return ALL_PROPERTY_METADATA.filter(m => m.category === category);
}

/**
 * Search properties by name, description, or aliases
 */
searchProperties(query: string): PropertyMetadata[] {
  const normalized = query.toLowerCase().trim();

  return ALL_PROPERTY_METADATA.filter(meta => {
    return meta.label.toLowerCase().includes(normalized) ||
           meta.description.toLowerCase().includes(normalized) ||
           meta.canonical.toLowerCase().includes(normalized) ||
           meta.aliases?.some(a => a.toLowerCase().includes(normalized));
  });
}
```

## Implementation Phases

### Phase 1: Foundation (Data & Service Layer)

**Tasks:**
1. Create property metadata structures in `property-alias-service.ts`
2. Define all 47 person properties with labels and descriptions
3. Define all 24 event properties with labels and descriptions
4. Define all 8 place properties with labels and descriptions
5. Add service methods: `getMetadata()`, `getPropertiesByCategory()`, `searchProperties()`
6. Write unit tests for new service methods

**Deliverable:** PropertyAliasService with complete metadata for all properties

### Phase 2: UI Components (Property Sections)

**Tasks:**
1. Create collapsible section component helper
2. Create property setting row helper (Setting with text input + clear button)
3. Build Person properties section (47 properties)
4. Build Event properties section (24 properties)
5. Build Place properties section (8 properties)
6. Add CSS for collapsible sections

**Deliverable:** Three working property sections with inline editing

### Phase 3: Search & Filter

**Tasks:**
1. Add search input at top of card
2. Implement debounced search handler
3. Filter properties by query (name, description, canonical)
4. Update section visibility based on filtered results
5. Update section counts to show "X of Y visible"
6. Add "No results" empty state

**Deliverable:** Working search/filter functionality

### Phase 4: Value Aliases Integration

**Tasks:**
1. Move existing value alias tables below property sections
2. Add separator/divider
3. Update section titles and descriptions
4. Keep existing ValueAliasModal for add/edit
5. Ensure consistent styling with property sections

**Deliverable:** Complete unified card with properties + values

### Phase 5: Polish & Refinement

**Tasks:**
1. Add keyboard shortcuts (Escape to clear search, etc.)
2. Add "Reset all" button per section
3. Add validation (prevent aliasing to canonical names)
4. Add helpful tooltips
5. Improve mobile responsiveness
6. Add loading states if needed
7. Write comprehensive CSS for all new components

**Deliverable:** Production-ready unified configuration card

### Phase 6: Testing & Documentation

**Tasks:**
1. Manual testing of all property types
2. Test search with various queries
3. Test collapsible section state persistence
4. Update wiki documentation
5. Add inline help (?) tooltips
6. Create before/after screenshots
7. Update CHANGELOG.md

**Deliverable:** Tested feature ready for release

## Technical Considerations

### Performance

**Concern:** Rendering ~80 Setting components could be slow

**Solutions:**
- Collapsible sections render collapsed by default (only Person section open)
- Lazy rendering: render section content only when expanded
- Search filters reduce visible elements
- Setting components are lightweight (native Obsidian)

**Implementation:**
```typescript
// Lazy render on section expand
section.addEventListener('toggle', () => {
  if (section.open && !section.dataset.rendered) {
    renderPropertySettings(sectionContent, properties);
    section.dataset.rendered = 'true';
  }
});
```

### State Management

**Auto-save behavior:**
- Text input `onChange` saves immediately
- No "Save" button needed (Obsidian pattern)
- Show brief success Notice only on first alias creation
- Clear button removes alias and shows Notice

**Search state:**
- Store in component-local variable (not persisted)
- Reset when card is closed/reopened

**Section collapse state:**
- Use browser's native `<details>` state (persists during session)
- Person section open by default
- Other sections closed by default

### Validation

**Prevent issues:**
1. Empty alias = use canonical (not an error)
2. Alias equals canonical = show warning, remove alias
3. Alias already used for different property = show error, prevent save
4. Invalid characters in alias = show error

**Validation UI:**
```typescript
text.onChange(async (value) => {
  const trimmed = value.trim();

  // Empty = remove alias
  if (trimmed === '') {
    await propertyAliasService.removeAlias(canonical);
    clearValidationError(setting);
    return;
  }

  // Same as canonical = warning
  if (trimmed === canonical) {
    showValidationWarning(setting, 'This is already the canonical name');
    await propertyAliasService.removeAlias(canonical);
    return;
  }

  // Check for duplicate
  const existingMapping = propertyAliasService.aliases[trimmed];
  if (existingMapping && existingMapping !== canonical) {
    showValidationError(setting, `"${trimmed}" is already mapped to "${existingMapping}"`);
    return;
  }

  // Valid - save
  await propertyAliasService.setAlias(trimmed, canonical);
  clearValidationError(setting);
});
```

### Backwards Compatibility

**No breaking changes:**
- Existing `propertyAliases` settings structure unchanged
- Existing aliases continue to work
- PropertyAliasService API unchanged
- Only UI changes

**Migration:**
- No migration needed
- Remove PropertyAliasModal component
- Update any references to modal

## CSS Requirements

### New Styles

```css
/* Property configuration sections */
.cr-property-section {
  margin-bottom: var(--cr-spacing-md);
}

.cr-property-section-summary {
  display: flex;
  align-items: center;
  gap: var(--cr-spacing-sm);
  padding: var(--cr-spacing-sm) 0;
  cursor: pointer;
  font-weight: 600;
  user-select: none;
}

.cr-property-section-summary:hover {
  color: var(--text-accent);
}

.cr-property-section-title {
  flex: 1;
}

.cr-property-section-count {
  color: var(--text-muted);
  font-size: 0.9em;
  font-weight: normal;
}

.cr-property-section-content {
  padding-left: var(--cr-spacing-md);
}

/* Remove top border from first setting in section */
.cr-property-section-content .setting-item:first-child {
  border-top: none;
}

/* Search input */
.cr-property-search {
  margin-bottom: var(--cr-spacing-lg);
  border-bottom: 1px solid var(--background-modifier-border);
  padding-bottom: var(--cr-spacing-md);
}

/* Validation messages */
.cr-property-validation-error {
  color: var(--text-error);
  font-size: 0.85em;
  margin-top: var(--cr-spacing-xs);
}

.cr-property-validation-warning {
  color: var(--color-orange);
  font-size: 0.85em;
  margin-top: var(--cr-spacing-xs);
}

/* Clear button styling */
.cr-property-clear-btn {
  opacity: 0.5;
}

.cr-property-clear-btn:hover {
  opacity: 1;
  color: var(--text-error);
}

/* Empty state for no search results */
.cr-property-no-results {
  padding: var(--cr-spacing-lg);
  text-align: center;
  color: var(--text-muted);
}

/* Section divider */
.cr-property-divider {
  height: 1px;
  background: var(--background-modifier-border);
  margin: var(--cr-spacing-xl) 0;
}
```

## Testing Plan

### Manual Testing Checklist

**Property Configuration:**
- [ ] All person properties display correctly
- [ ] All event properties display correctly
- [ ] All place properties display correctly
- [ ] Text input shows current alias or empty
- [ ] Placeholder shows canonical name
- [ ] Typing in input updates alias (auto-save)
- [ ] Clearing input removes alias
- [ ] Clear button (x) removes alias
- [ ] Multiple aliases can be configured simultaneously

**Search:**
- [ ] Search filters properties by label
- [ ] Search filters properties by description
- [ ] Search filters properties by canonical name
- [ ] Search shows "No results" when appropriate
- [ ] Search is debounced (doesn't lag on typing)
- [ ] Clearing search shows all properties
- [ ] Section counts update based on filtered results

**Collapsible Sections:**
- [ ] Person section opens by default
- [ ] Other sections closed by default
- [ ] Clicking summary toggles section
- [ ] Section state persists during session
- [ ] Empty sections still toggle correctly

**Validation:**
- [ ] Empty alias removes mapping (no error)
- [ ] Alias = canonical shows warning
- [ ] Duplicate alias shows error
- [ ] Invalid characters show error
- [ ] Valid aliases save without error

**Value Aliases:**
- [ ] Value alias tables display below properties
- [ ] Value alias modals still work
- [ ] Value aliases don't interfere with property search

**Backwards Compatibility:**
- [ ] Existing aliases load correctly
- [ ] Existing aliases work in all features
- [ ] Settings structure unchanged

## Success Criteria

✅ **User can discover all available properties**
- All ~80 properties visible in unified card
- Properties grouped by entity type
- Clear labels and descriptions

✅ **User can configure aliases inline**
- No modals required for property aliases
- Text input with auto-save
- Clear button for easy removal

✅ **User can find properties quickly**
- Search filters by multiple criteria
- Results highlight relevant sections
- No-results state when needed

✅ **UI matches Obsidian patterns**
- Uses native Setting components
- Follows Obsidian styling conventions
- Responsive and accessible

✅ **No breaking changes**
- Existing aliases work unchanged
- Service APIs unchanged
- Settings structure unchanged

✅ **Performance is acceptable**
- No lag when expanding sections
- Search is responsive
- Large property lists don't slow UI

## Future Enhancements

**v2 considerations:**

1. **Bulk operations**
   - "Reset all aliases" per section
   - Export/import alias configurations

2. **Alias suggestions**
   - Show common alternatives for each property
   - One-click to apply suggested alias

3. **Usage statistics**
   - Show which properties are used in vault
   - Highlight frequently used properties

4. **Property usage examples**
   - Show example value for each property
   - Link to documentation

5. **Advanced filtering**
   - Filter by "has alias" vs "no alias"
   - Filter by entity type
   - Combine search with filters

6. **Keyboard navigation**
   - Tab through property inputs
   - Keyboard shortcuts for common actions

## Questions & Decisions

### Decided

1. **Use Obsidian Setting components** ✅
   - Consistent with Obsidian UI
   - Auto-save behavior
   - Built-in styling

2. **Collapsible sections with `<details>`** ✅
   - Native HTML element
   - No custom collapse logic needed
   - Browser handles state

3. **Person section open by default** ✅
   - Most commonly used
   - Good starting point for new users

4. **Keep value aliases in same card** ✅
   - Single source of truth
   - Related functionality
   - Avoid over-fragmentation

5. **No modal for property aliases** ✅
   - Inline editing is faster
   - Better discoverability
   - More Obsidian-like

### Open Questions

1. **Section default state:**
   - Should ALL sections be open by default for discoverability?
   - Or just Person section (cleaner but requires expanding)?
   - **Proposal:** Person open, others closed. Users can expand as needed.

2. **Property order within sections:**
   - Alphabetical by label?
   - Grouped by type (identity, dates, relationships, etc.)?
   - **Proposal:** Logical grouping (identity → dates → places → relationships → other)

3. **Mobile responsiveness:**
   - How should property sections display on narrow screens?
   - Stack Setting components vertically (native behavior)?
   - **Proposal:** Trust Obsidian's responsive behavior for Setting components

4. **Help documentation:**
   - Inline help icon (?) for each property?
   - Link to external docs?
   - **Proposal:** Start simple (description text only), add help icons if users request

5. **Performance threshold:**
   - At what point should we implement lazy rendering?
   - Test with all sections expanded first?
   - **Proposal:** Implement lazy rendering from start (expand triggers render)

## Related Documentation

- [Property Aliases Planning Document](property-aliases.md)
- [Value Aliases Planning Document](value-aliases.md)
- [Frontmatter Reference](../../wiki-content/Frontmatter-Reference.md)
- [Settings and Configuration](../../wiki-content/Settings-And-Configuration.md)

## Status

**✅ Completed**

Branch: `feature/unified-property-config`

### Implementation Summary

**Phase 1: Foundation (Data & Service Layer)** - ✅ Complete
- Created PropertyMetadata interface with canonical, label, description, category, and commonAliases
- Defined 27 person properties, 20 event properties, 8 place properties (55 total)
- Added 6 new service methods to PropertyAliasService
- Build passed successfully

**Phase 2: UI Components** - ✅ Complete
- Implemented collapsible sections using `<details>` elements with lazy rendering
- Added search/filter functionality across all property metadata
- Replaced modal-based UI with inline Obsidian Setting components
- Person section open by default, Event/Place collapsed
- Added comprehensive CSS for unified property configuration
- Build passed successfully

**Phase 3: Bug Fixes** - ✅ Complete
- Fixed validation blocking partial input (e.g., "sex2")
- Moved validation from onChange to blur event
- Added value restoration on validation failure

### Decisions Made

All open questions resolved during implementation:

1. **Section default state:** Person open, others closed ✅
2. **Property order:** Logical grouping (identity → dates → places → relationships → other) ✅
3. **Mobile responsiveness:** Trust Obsidian's native responsive behavior ✅
4. **Help documentation:** Description text only (no inline help icons) ✅
5. **Performance:** Lazy rendering implemented from start ✅

### Technical Notes

- Used `cr_type` instead of deprecated `type` property for consistency
- Validation only on blur prevents blocking user input mid-typing
- Search filters across label, description, canonical name, and commonAliases
- Lazy rendering loads section content only when first expanded

## Changelog

- 2025-12-10: Initial planning document created
- 2025-12-10: Phase 1 (Foundation) completed - Property metadata and service methods
- 2025-12-10: Phase 2 (UI Components) completed - Collapsible sections with search
- 2025-12-10: Phase 3 (Bug Fixes) completed - Fixed validation blocking partial input
- 2025-12-10: Implementation completed and documented
