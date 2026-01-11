# Settings Consolidation

- **Status:** Planning
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

Proposed section structure for consolidated Plugin Settings:

| Section | Contents |
|---------|----------|
| **Folders** | People, Places, Maps, Schemas, Canvases folder locations |
| **Property aliases** | Field name mappings for all note types |
| **Value aliases** | Event type, sex, place category, note type mappings |
| **Data & detection** | cr_id generation, type property, tag detection, GEDCOM compat, bidirectional sync |
| **Date & validation** | Date validation rules, sex normalization, inclusive parents |
| **Privacy & export** | Privacy protection, living person threshold, display format, filename pattern |
| **Places** | Category subfolders, custom folder overrides |
| **Integrations** | Calendarium settings |
| **Research tools** | Fact-level source tracking |
| **Logging** | Log level, export folder, obfuscation |
| **Advanced** | Folder filtering, display preferences |

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
