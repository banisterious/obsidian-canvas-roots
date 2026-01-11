# Settings Consolidation

- **Status:** Complete
- **Target Version:** v0.19.5
- **Related Issue:** [#176](https://github.com/banisterious/obsidian-charted-roots/issues/176)
- **Created:** 2026-01-10
- **Origin:** User feedback from jeff962 in [Discussion #147](https://github.com/banisterious/obsidian-charted-roots/discussions/147)

## Problem Statement

Plugin settings are currently split between two locations:

**Control Center → Preferences:**
- Folder locations (People, Places, Maps, Schemas, Canvases)
- Property aliases (field name mappings)
- Value aliases (event_type, sex value mappings)
- Place organization (category subfolders)
- Date validation settings
- Sex normalization mode
- Inclusive parent relationships
- Display preferences
- Integrations (Calendarium)

**Obsidian Settings → Charted Roots:**
- Data & detection (auto-generate cr_id, type property, tag detection, etc.)
- Privacy & export (protection toggle, age threshold, display format)
- Research tools (fact-level source tracking)
- Logging (level, export folder, obfuscation)
- Advanced (folder filtering)

This split creates confusion for users who don't know which location to check. Both locations include cross-reference callouts pointing to each other, which adds friction rather than solving the underlying problem.

The original rationale was that Preferences would contain "frequently adjusted" settings close to the data, while Plugin Settings would contain "set once and forget" options. In practice, nearly all settings in both locations are configured once during setup and rarely changed afterward.

## Proposed Solution

Consolidate all settings into the standard Obsidian Plugin Settings location (Settings → Charted Roots).

### Benefits

1. **Follows Obsidian conventions** - Users expect plugin settings in the standard location
2. **Eliminates cross-reference callouts** - No more "Looking for X? Go to Y" friction
3. **Reduces cognitive load** - Single location to check
4. **Focuses Control Center** - Dashboard, Data Quality, Statistics become purely operational

### New Settings Organization

Consolidated into 9 top-level sections:

#### 1. Folders
All note and file storage locations.

| Subsection | Settings |
|------------|----------|
| Entity folders | People, Places, Events, Sources, Organizations, Universes |
| Output folders | Canvases, Maps, Timelines, Reports, Bases |
| System folders | Schemas, Staging, Logs |

#### 2. Data & detection
How Charted Roots identifies and syncs notes.

| Subsection | Settings |
|------------|----------|
| Note type detection | Primary type property, tag detection, auto-generate cr_id |
| Relationships | Bidirectional sync, sync on file modify, relationship history |
| Import compatibility | GEDCOM compatibility mode |

#### 3. Canvas & trees
Tree generation layout and styling.

| Subsection | Settings |
|------------|----------|
| Node dimensions | Width, height |
| Spacing | Horizontal, vertical |
| Layout options | Grouping strategy |
| Arrow styles | Parent-child arrows, spouse arrows |
| Colors | Node color scheme, edge colors |
| Spouse edges | Show/hide, label format |

#### 4. Privacy & export
Privacy protection and export settings.

| Subsection | Settings |
|------------|----------|
| Living person protection | Enable, age threshold, display format, hide details |
| Export options | Filename pattern, GEDCOM version |

#### 5. Dates & validation
Date format and validation rules.

| Setting | Description |
|---------|-------------|
| Format standard | iso8601 / gedcom / flexible |
| Partial dates | Allow year-only, month-year |
| Circa dates | Allow ABT, BEF, AFT qualifiers |
| Date ranges | Allow BET...AND ranges |
| Leading zeros | Require 01 vs 1 |

#### 6. Sex & gender
Sex normalization and inclusive options.

| Setting | Description |
|---------|-------------|
| Sex normalization mode | standard / schema-aware / disabled |
| Inclusive parents | Enable gender-neutral parent property |
| Parent field label | Label for parent field (e.g., "Parents", "Guardians") |
| Show pronouns | Display pronouns in UI |

#### 7. Places
Place organization and coordinate handling.

| Subsection | Settings |
|------------|----------|
| Category organization | Use category subfolders, default category, category rules |
| Folder mapping | Category → folder rules |
| Coordinates | Accept DMS format |

#### 8. Property & value aliases
Custom frontmatter names and value mappings.

| Subsection | Settings |
|------------|----------|
| Property aliases | Person, Event, Place, Source (collapsible per type) |
| Value aliases | Event type, Sex, Place category, Note type |

#### 9. Advanced
Less frequently used settings.

| Subsection | Settings |
|------------|----------|
| Folder filtering | Filter mode, excluded/included folders, staging isolation |
| Template detection | Auto-detect template folders, additional template folders |
| Media folders | Folder list, enable filter |
| Research tools | Fact sourcing, coverage threshold, gaps in status |
| Integrations | Calendarium mode, sync Calendarium events |
| Logging | Log level, obfuscate exports |

### Migration Path

1. **Phase 1:** Add all Preferences settings to Plugin Settings
2. **Phase 2:** Add deprecation notice to Preferences tab with link to Plugin Settings
3. **Phase 3:** Remove Preferences tab from Control Center (future release)

### UI Considerations

- Existing collapsible `<details>` sections work well for organization
- Search box already exists in Plugin Settings
- Property/value alias editors need adaptation from card-based to standard Setting format

## Implementation Notes

### Files Affected

- `src/settings.ts` - Add new sections, migrate render functions
- `src/ui/preferences-tab.ts` - Add deprecation notice, eventually remove
- `src/ui/control-center-modal.ts` - Remove Preferences tab registration
- `src/core/property-alias-service.ts` - No changes (service layer unchanged)
- `src/core/value-alias-service.ts` - No changes (service layer unchanged)

### Complexity Considerations

- **Property alias UI** is complex (collapsible sections per note type, inline editing)
- **Value alias UI** has custom modals for adding mappings
- **Folder suggestions** use custom AbstractInputSuggest component
- May need to adapt card-based layouts to work within standard Setting rows

### Testing Considerations

- Verify all settings save/load correctly after migration
- Test that deprecated Preferences still functions during transition
- Ensure no regressions in property/value alias behavior

## Success Criteria

- [x] All Preferences settings accessible in Plugin Settings
- [x] Preferences tab shows deprecation notice with link
- [x] Property alias editing works in new location
- [x] Value alias editing works in new location
- [x] Folder suggestions work in new location
- [x] No regression in existing functionality
- [x] Cross-reference callouts removed from both locations
