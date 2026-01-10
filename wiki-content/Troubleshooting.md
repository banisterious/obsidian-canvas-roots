# Troubleshooting

Solutions to common issues with Charted Roots.

---

## Table of Contents

- [Tree Generation](#tree-generation)
- [Bidirectional Sync](#bidirectional-sync)
- [Import/Export](#importexport)
- [Map View](#map-view)
- [Family Chart View](#family-chart-view)
- [Excalidraw Export](#excalidraw-export)
- [Performance Issues](#performance-issues)
- [Getting More Help](#getting-more-help)

---

## Tree Generation

### Tree not generating

**Symptoms:** Clicking "Generate tree" does nothing or shows an error.

**Solutions:**
1. Check that the root person has a `cr_id` value
2. Verify relationships use valid `cr_id` references
3. Enable debug logging: Settings → Charted Roots → Logging → Enable debug mode
4. Check the developer console (Ctrl/Cmd + Shift + I) for errors

### Missing people in tree

**Symptoms:** Some family members don't appear in the generated tree.

**Solutions:**
1. Verify their `cr_id` values match the references in relationship fields
2. Check generation limits - they may be excluding distant relatives
3. If spouses are missing, ensure "Include spouses" is enabled
4. Verify the person has a relationship path to the root person

### Layout issues

**Symptoms:** Nodes overlap, spacing is wrong, or the tree looks distorted.

**Solutions:**
1. Try different spacing values in Canvas Settings
2. Switch between vertical and horizontal layout
3. For large trees, try the Compact algorithm
4. Regenerate the canvas with latest settings

### Wrong relationships displayed

**Symptoms:** Lines connect the wrong people, or relationships are missing.

**Solutions:**
1. Check that `cr_id` values are unique (no duplicates)
2. Verify relationship properties point to correct IDs
3. Run "Validate relationships" command to find inconsistencies
4. Check for circular relationships (A is parent of B, B is parent of A)

## Bidirectional Sync

### Relationships not syncing

**Symptoms:** Adding a father to one note doesn't add the child to the other.

**Solutions:**
1. Verify bidirectional sync is enabled: Settings → Charted Roots → Data
2. Check that "Sync on file modify" is also enabled
3. Ensure both person notes have valid `cr_id` fields
4. Check console for sync errors

### Orphaned relationships after deletion

**Symptoms:** After deleting a relationship, the reciprocal link remains.

**Solutions:**
1. This happens if sync was disabled during deletion
2. Run "Validate relationships" command to find orphaned links
3. Manually remove the orphaned reference
4. Keep sync enabled to prevent future occurrences

### Sync not working with external editors

**Symptoms:** Edits made in VS Code or other editors don't trigger sync.

**Solutions:**
1. Ensure Obsidian is running when editing externally
2. Wait for Obsidian to detect file changes (usually automatic)
3. Check that files have valid frontmatter with `cr_id`
4. Try editing within Obsidian to verify sync works

## Import/Export

### GEDCOM import problems

**Symptoms:** Import fails, shows errors, or missing data.

**Solutions:**
1. Verify the file is valid GEDCOM 5.5.1 format
2. Check file encoding (should be UTF-8 or ASCII)
3. Try importing a smaller subset first
4. Review import log for specific errors
5. Some GEDCOM exports from older software may have non-standard tags

**Sharing files for bug reports:**

If you need to share your GEDCOM file to help debug import issues, use the anonymization tool to protect your privacy:

1. Download the anonymization script: [tools/anonymize_gedcom.py](https://github.com/banisterious/obsidian-charted-roots/blob/main/tools/anonymize_gedcom.py)
2. Run it on your GEDCOM file:
   ```
   python anonymize_gedcom.py your_file.ged anonymized_file.ged
   ```
3. The script replaces names with "Person 1", "Person 2", etc. while preserving the file structure
4. Optional flags:
   - `--keep-dates` - Preserve dates (useful for date-related bugs)
   - `--keep-places` - Preserve place names (useful for place-related bugs)
5. Review the anonymized file before sharing to ensure you're comfortable with the content

### GEDCOM export missing data

**Symptoms:** Exported GEDCOM has fewer people or missing relationships.

**Solutions:**
1. Check privacy settings aren't excluding people
2. Verify all people have `cr_id` values
3. Export from the correct folder
4. Check console for export errors

### CSV import column mapping issues

**Symptoms:** Data imports to wrong fields or is missing.

**Solutions:**
1. Review auto-detected column mapping before importing
2. Manually adjust mappings if column names don't match
3. Use standard column names: name, born, died, father, mother, spouse
4. Check for extra whitespace in column headers

## Map View

### Places not showing on map

**Symptoms:** Map is empty or some places don't appear.

**Solutions:**
1. Verify places have coordinates (`coordinates.lat` and `coordinates.long`)
2. Check that places are within the visible map bounds
3. Verify layer toggles haven't hidden the marker types
4. For custom maps, check `universe` property matches between places and map

### Custom map not loading

**Symptoms:** Custom image map shows blank or errors.

**Solutions:**
1. Verify the image path in frontmatter is correct
2. Check the image file exists in your vault
3. Verify bounds are defined (`bounds.north`, `.south`, `.east`, `.west`)
4. Check `type: map` is set in frontmatter

### Map alignment won't save

**Symptoms:** Dragging corners works but Save doesn't persist.

**Solutions:**
1. Ensure you click "Save alignment" after adjusting
2. Check the map note file for write permissions
3. Verify the map note has valid frontmatter
4. Check console for save errors

## Family Chart View

### Chart won't load

**Symptoms:** Family Chart View shows blank or loading forever.

**Solutions:**
1. Verify the root person has valid data and `cr_id`
2. Check that person has at least one relationship
3. Try a different root person
4. Check console for JavaScript errors

### Edits not saving to notes

**Symptoms:** Changes made in edit mode disappear.

**Solutions:**
1. Ensure you save changes before exiting edit mode
2. Verify the person note file isn't locked or read-only
3. Check that bidirectional sync is working
4. Check console for save errors

### Export produces blank file

**Symptoms:** PNG or SVG export creates empty or corrupted file.

**Solutions:**
1. Ensure the chart is fully loaded before exporting
2. Try zooming to fit before export
3. Check available disk space
4. Try the other format (SVG instead of PNG, or vice versa)

## Excalidraw Export

### Excalidraw file appears blank

**Symptoms:** Exported file opens but shows nothing.

**Solutions:**
1. Ensure Excalidraw plugin is installed and up-to-date
2. Check Charted Roots version (export fixes in v0.2.1+)
3. Try re-exporting the Canvas
4. Verify the Canvas has valid nodes

### Nodes positioned incorrectly

**Symptoms:** Nodes are off-screen or overlapping strangely.

**Solutions:**
1. Charted Roots normalizes negative coordinates automatically
2. Try regenerating the Canvas first, then re-export
3. In Excalidraw, use "Fit to content" to find nodes

## Performance Issues

### Slow tree generation

**Symptoms:** Generating trees takes a long time.

**Solutions:**
1. Limit generations for large trees
2. Generate ancestors or descendants separately
3. Use the Preview feature first (faster than full generation)
4. Close other heavy tabs/views while generating

### Obsidian lag after installing plugin

**Symptoms:** Obsidian becomes slow with Charted Roots enabled.

**Solutions:**
1. Disable debug logging if enabled
2. Check vault size - very large vaults may need optimization
3. Disable "Sync on file modify" if you don't need live sync
4. Report issue with performance profile if problem persists

## Getting More Help

If these solutions don't resolve your issue:

1. **Check existing issues**: [GitHub Issues](https://github.com/banisterious/obsidian-charted-roots/issues)
2. **Enable debug logging**: Settings → Charted Roots → Logging
3. **Collect information**:
   - Obsidian version
   - Charted Roots version
   - Error messages from console
   - Steps to reproduce
4. **Open a new issue**: [Report a bug](https://github.com/banisterious/obsidian-charted-roots/issues/new)
