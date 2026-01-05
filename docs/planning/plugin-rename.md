# Plugin Rename: Canvas Roots → Charted Roots

Planning document for renaming the plugin from "Canvas Roots" to "Charted Roots".

- **Status:** Planning
- **GitHub Issue:** [#141](https://github.com/banisterious/obsidian-canvas-roots/issues/141)
- **Created:** 2026-01-05
- **Community Discussion:** [#58](https://github.com/banisterious/obsidian-canvas-roots/discussions/58)

---

## Overview

Community feedback indicates the current name "Canvas Roots" creates confusion about the plugin's scope. This document outlines the plan for renaming to "Charted Roots" while maintaining backward compatibility.

### Goals

1. **Clarify plugin scope** — Name should reflect broader genealogical visualization capabilities
2. **Maintain backward compatibility** — Existing user vaults continue working without modification
3. **Preserve technical continuity** — Keep `cr-` prefixes for CSS and properties
4. **Minimize disruption** — Single coordinated update across all touchpoints

### Non-Goals

- Changing internal variable names (no breaking changes)
- Modifying CSS class prefixes (`cr-*` preserved)
- Altering property names (`cr_*` preserved for compatibility)
- Requiring user vault modifications

---

## Problem Statement

**Community feedback highlights:**
- "Canvas" suggests the plugin only works with Obsidian Canvas
- Traditional family tree users may not realize the plugin supports their workflow
- The name doesn't reflect capabilities beyond canvas visualization
- Potential users searching for genealogy plugins may miss it

**Evidence from Discussion #58:**
- Multiple users expressed initial confusion about whether non-canvas features existed
- Interest in renaming to better reflect multi-visualization approach
- Consensus around keeping "Roots" in the name

---

## Proposed Solution

Rename to **Charted Roots** because:

- **Broader applicability:** Encompasses charts, trees, graphs, networks, and canvas visualizations
- **Preserves brand identity:** Keeps "Roots" and starts with 'C'
- **Technical continuity:** Maintains `cr-` prefix for CSS BEM and properties
- **Cross-use-case:** Works for genealogy, worldbuilding, organizational charts
- **Searchability:** "Charted" relates to genealogical charts, family trees, relationship mapping
- **No naming conflicts:** No established tools or standards use this name

---

## Implementation Plan

### Phase 1: Code and Documentation Updates

**Files to update:**

1. **Plugin Metadata:**
   - `manifest.json` — `name`, `id` fields
   - `package.json` — `name`, `description` fields; add "canvas-roots" to keywords for searchability
   - `versions.json` — No changes needed (historical record)

2. **Documentation:**
   - `README.md` — All references to "Canvas Roots"; add "Formerly known as Canvas Roots" note near top
   - `CONTRIBUTING.md` — Plugin name references
   - `wiki-content/*.md` — All wiki pages
   - `docs/developer/**/*.md` — Developer documentation
   - `docs/planning/*.md` — Planning documents

3. **Code Comments:**
   - Search for "Canvas Roots" in code comments
   - Update references to reflect new name
   - No changes to variable names or code logic

4. **User-Facing Strings:**
   - Plugin settings tab title
   - Modal titles and descriptions
   - Notice messages
   - Error messages

**Not changed:**
- CSS class prefixes (`cr-*`)
- Property prefixes (`cr_*`)
- Internal variable/function names
- File paths or directory structure

### Phase 2: Repository and External Updates

**GitHub Repository:**
1. Rename repository: `obsidian-canvas-roots` → `obsidian-charted-roots`
   - GitHub automatically redirects old URLs
   - Update any hardcoded URLs in documentation

2. Update repository metadata:
   - Description
   - Topics/tags
   - About section

**Obsidian Community:**
3. Update Obsidian Community Plugins listing
   - Plugin name
   - Description
   - Search tags

**External References:**
4. Update any external links or badges in README
5. Announcement in Discussions

### Phase 3: Release and Communication

**Release Process:**
1. Create release with clear migration notes
2. Bump version to indicate rename (e.g., v0.19.0)
3. Update CHANGELOG.md with rename entry

**User Communication:**
- Plugin update will show new name
- No action required from users
- All existing functionality preserved
- Data remains fully compatible

---

## Migration Notes

### For Users

**What changes:**
- Plugin name in settings/community plugins list
- Documentation and README references

**What stays the same:**
- All your vault data and notes
- All CSS classes and styling
- All property names
- All plugin functionality
- All settings and configurations

**Action required:** None. Update normally.

### For Developers

**Breaking changes:** None

**Compatibility:**
- CSS selectors using `cr-*` classes continue to work
- Properties with `cr_*` prefix continue to work
- All APIs and interfaces unchanged
- Custom snippets/themes remain compatible

---

## Testing Plan

Before release:
1. Test fresh install with new name
2. Test update from Canvas Roots to Charted Roots
3. Verify all documentation links work
4. Verify GitHub redirect from old repo URL
5. Test Community Plugins search/discovery
6. Verify CSS/properties backward compatibility

---

## Rollback Plan

If critical issues arise:
1. Revert repository name change (GitHub allows)
2. Release patch version with old name
3. Communicate issue to users

---

## Timeline

**Estimated effort:** 4-6 hours
- Code/docs updates: 2-3 hours
- Testing: 1-2 hours
- Repository/community updates: 1 hour

**Proposed release:** After community feedback period on Discussion #58

---

## Decisions

1. **Version bump: v0.19.0 (minor)**
   - Non-breaking change (all data, CSS, properties remain compatible)
   - v1.0.0 reserved for major feature completion or API stability milestone
   - v0.19.0 signals significant change without implying breaking changes

2. **Discussion monitoring: 24-48 hours**
   - Wait for community feedback on Discussion #58
   - Proceed if no major objections emerge
   - Can revisit if feedback comes later

3. **Preserve "Canvas Roots" for searchability: Yes, strategically**
   - Add "Formerly known as Canvas Roots" note in README
   - Include both "canvas-roots" and "charted-roots" in package.json keywords
   - Remove legacy references after 6-12 months once search rankings stabilize

---

## Related Documents

- [Community Discussion #58](https://github.com/banisterious/obsidian-canvas-roots/discussions/58)
- [Roadmap](../../wiki-content/Roadmap.md)

---

## Notes

- Name collision check performed: No existing "Charted Roots" tools found
- "Kinship Roots" rejected due to collision with KRN (Kinship Roots Narrative) standard
- Community feedback period ongoing in Discussion #58
