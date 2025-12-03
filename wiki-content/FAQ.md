# FAQ

Common questions about Canvas Roots.

## General

### What is Canvas Roots?

Canvas Roots is an Obsidian plugin that transforms genealogical data stored in your markdown notes into visual family trees on the Obsidian Canvas. It supports both real-world family research and fictional world-building.

### Do I need to know how to code?

No. Canvas Roots uses YAML frontmatter in your markdown notes, which is a simple key-value format. If you can write `name: John Smith`, you can use Canvas Roots.

### Can I use Canvas Roots for fictional family trees?

Yes! Canvas Roots works equally well for real genealogy and fictional world-building. Use the `universe` property on place notes to organize fictional worlds, and the geographic features support custom image maps for fantasy worlds.

## Data Entry

### What's the minimum information needed for a person?

Just two things:
- `cr_id`: A unique identifier (Canvas Roots can auto-generate this)
- `name`: The person's name

Everything else (dates, relationships, places) is optional.

### Should I use wikilinks or IDs for relationships?

Use both when possible. Wikilinks (`father: "[[John Smith]]"`) show in Obsidian's graph view and backlinks. IDs (`father_id: "abc-123"`) provide reliable programmatic resolution that survives file renames.

### How do I handle multiple marriages?

Use indexed spouse properties:
```yaml
spouse1: "[[First Spouse]]"
spouse1_id: "spouse1-cr-id"
spouse1_marriage_date: "1980"
spouse2: "[[Second Spouse]]"
spouse2_id: "spouse2-cr-id"
spouse2_marriage_date: "1995"
```

### What date formats are supported?

Canvas Roots accepts:
- Year only: `1888`
- Year and month: `1888-05`
- Full date: `1888-05-15`

ISO format (YYYY-MM-DD) is recommended for consistency.

## Tree Generation

### Why isn't someone showing in my tree?

Check:
1. They have a `cr_id` property
2. Their `cr_id` is referenced correctly in relationship fields
3. Generation limits aren't excluding them
4. If they're a spouse, check if "Include spouses" is enabled

### What's the difference between layout algorithms?

- **Standard**: Best for most trees, proper spouse positioning
- **Compact**: 50% tighter spacing for large trees (50+ people)
- **Timeline**: Positions by birth year horizontally
- **Hourglass**: Root person centered, ancestors above, descendants below

### How do I update a tree after editing notes?

Right-click the canvas → "Regenerate canvas", or use the command palette.

## Family Chart View

### What's the difference between Family Chart View and Canvas?

| Aspect | Family Chart View | Canvas |
|--------|-------------------|--------|
| Purpose | Interactive exploration | Static documentation |
| Editing | Direct in-chart editing | Edit source notes |
| Persistence | View state saved | Canvas file saved |
| Best for | Day-to-day research | Sharing/archiving |

### Can I have multiple chart views open?

Yes. Use "Open new family chart" to open additional tabs with different root persons.

## Import/Export

### What genealogy software can I import from?

Canvas Roots supports GEDCOM 5.5.1 format, which is exported by:
- Ancestry
- FamilySearch
- MyHeritage
- Gramps
- Legacy Family Tree
- Most other genealogy software

### Will importing overwrite my existing data?

No. Canvas Roots detects duplicates by `cr_id` and updates relationships without overwriting research notes you've added.

### How do I protect living relatives in exports?

Enable privacy protection in Settings → Canvas Roots → GEDCOM:
- Set a birth year threshold
- Choose to exclude or anonymize living persons

## Geographic Features

### Do I need coordinates for every place?

No. Coordinates are only needed for map visualization. Places without coordinates still work for frontmatter references and hierarchy.

### Can I use custom maps for fictional worlds?

Yes. Create a map note with a custom image and coordinate bounds. See [Geographic Features](Geographic-Features#custom-image-maps) for details.

### How do I look up coordinates automatically?

Canvas Roots can query OpenStreetMap's Nominatim service. In place editing, click "Look up coordinates" and review the results.

## Performance

### How many people can Canvas Roots handle?

Canvas Roots has been tested with trees of 500+ people. For very large trees:
- Use generation limits
- Generate focused subtrees (ancestors only, or descendants only)
- Use the Compact layout algorithm

### Why is tree generation slow?

Large trees with complex relationships take longer. Try:
- Limiting generations
- Generating ancestors or descendants separately
- Using the Preview feature to check layout before generating

## Troubleshooting

### My tree won't generate

- Verify the root person has a `cr_id`
- Check relationships reference valid `cr_id` values
- Enable debug logging in Settings → Canvas Roots → Logging

### Relationships aren't syncing bidirectionally

- Verify bidirectional sync is enabled in Settings
- Check that "Sync on file modify" is also enabled
- Ensure person notes have valid `cr_id` fields

### GEDCOM import shows errors

- Verify the file is valid GEDCOM 5.5.1 format
- Check for encoding issues (should be UTF-8)
- Try importing a smaller subset first

## Getting Help

- **Bug reports**: [GitHub Issues](https://github.com/banisterious/obsidian-canvas-roots/issues)
- **Feature requests**: [GitHub Issues](https://github.com/banisterious/obsidian-canvas-roots/issues) with "enhancement" label
- **Documentation**: This wiki
