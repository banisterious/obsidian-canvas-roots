# Roadmap

This document outlines planned features for Canvas Roots. For completed features, see [Release History](Release-History). For version-specific changes, see the [GitHub Releases](https://github.com/banisterious/obsidian-canvas-roots/releases).

---

## Table of Contents

- [Completed Features](#completed-features)
- [Planned Features](#planned-features)
  - [Data Enhancement Pass](#data-enhancement-pass)
  - [Type Customization](#type-customization)
  - [Print & PDF Export](#print--pdf-export)
  - [Research & Analysis Tools](#research--analysis-tools)
  - [Transcript Nodes & Oral History](#transcript-nodes--oral-history)
- [Future Considerations](#future-considerations)
- [Known Limitations](#known-limitations)
- [Contributing](#contributing)

---

## Completed Features

For detailed implementation documentation of completed features, see [Release History](Release-History).

| Version | Feature | Summary |
|:-------:|---------|---------|
| v0.10.3 | [Type Customization](Release-History#type-customization-v0103) | Full type managers for all note categories |
| v0.10.2 | [Flexible Note Type Detection](Release-History#flexible-note-type-detection-v0102) | Support cr_type, tags, avoids conflicts |
| v0.10.1 | [GEDCOM Import v2](Release-History#gedcom-import-v2-v0101) | Enhanced import with sources, events, and places |
| v0.10.0 | [Chronological Story Mapping](Release-History#chronological-story-mapping-v0100) | Event notes, timelines, narrative support |
| v0.9.4 | [Value Aliases](Release-History#value-aliases-v094) | Custom terminology for property values |
| v0.9.3 | [Property Aliases](Release-History#property-aliases-v093) | Map custom property names to canonical fields |
| v0.9.2 | [Events Tab](Release-History#events-tab-v092) | Control Center tab for event management |
| v0.9.1 | [Style Settings Integration](Release-History#style-settings-integration-v091) | Customize colors via Style Settings plugin |
| v0.9.0 | [Evidence Visualization](Release-History#evidence-visualization-v090) | GPS-aligned research methodology tools |
| v0.8.0 | [Source Media Gallery](Release-History#source-media-gallery--document-viewer-v080) | Evidence management and citation generator |
| v0.7.0 | [Organization Notes](Release-History#organization-notes-v070) | Non-genealogical hierarchies |
| v0.7.0 | [Fictional Date Systems](Release-History#fictional-date-systems-v070) | Custom calendars and eras |
| v0.7.0 | [Custom Relationship Types](Release-History#custom-relationship-types-v070) | Non-familial relationships |
| v0.6.3 | [Schema Validation](Release-History#schema-validation-v063) | User-defined data quality rules |
| v0.6.2 | [Maps Tab](Release-History#maps-tab-v062) | Control Center tab for map management |
| v0.6.0 | [Geographic Features](Release-History#geographic-features-v060) | Interactive Leaflet.js map view |
| v0.6.0 | [Import/Export Enhancements](Release-History#importexport-enhancements-v060) | GEDCOM, GEDCOM X, Gramps, CSV support |

---

## Planned Features

### Data Enhancement Pass

**Summary:** Upgrade existing vaults by creating missing linked entities from person note data. For users who imported GEDCOM before sources, events, and places were supported.

**Use Cases:**
1. Imported GEDCOM before v0.10.0 (no event notes)
2. Imported GEDCOM before v0.9.0 (no source notes)
3. Have person notes with place strings instead of wikilinks
4. Want to retroactively create event notes from existing date fields

**Planned Features:**
- Generate Events from Dates: Scan person notes, create event notes, link to persons
- Generate Place Notes: Extract unique place strings, create hierarchy, update wikilinks
- Re-parse GEDCOM for Sources: Match individuals to existing notes, extract `SOUR` records
- Preview mode before committing changes
- New card in Import/Export tab: "Enhance existing data"

---

### Print & PDF Export

**Summary:** Generate print-ready and PDF outputs of family trees and reports.

**Export Types:**
- Pedigree Chart (ancestor-focused, 4-5 generations per page)
- Descendant Chart
- Family Group Sheet (single family with sources)
- Full Tree Poster (large format)

**Features:**
- Page size presets (Letter, A4, custom, poster)
- Multi-page output with page breaks
- Privacy filter (exclude/anonymize living persons)
- SVG and high-resolution PNG export

---

### Research & Analysis Tools

**Family Statistics Dashboard:**
- Longevity analysis by generation/period
- Geographic distribution maps
- Most common names, occupations, places
- Generation gap analysis
- Marriage patterns

**Research Tracking:**
- "Needs research" tags with to-dos
- Confidence levels: verified, probable, possible
- Source documentation per fact
- DNA match tracking

**Dynasty Management:**
- Line of succession calculator
- Title/position inheritance
- Regnal numbering

---

### Transcript Nodes & Oral History

**Summary:** Time-stamped citations from audio/video with direct linking.

**Schema:**
```yaml
oral_facts:
  - media: "[[Interview with Grandma.mp3]]"
    timestamp: "1m30s"
    fact_type: birth_date
    quote: "I was born on May 15th, 1922"
```

**Features:**
- Deep links with timestamp: `[[Interview.mp3]]#t=1m30s`
- Range support: `#t=1m30s-2m15s`
- One-click playback from timestamp
- Transcript nodes with speech bubble styling on canvas

**Interview Subject Graph:**
- Map relationship structure of interviews
- Interview as central hub node
- Edge thickness indicates mention frequency

---

## Future Considerations

These features are under consideration but not yet prioritized.

### Sensitive Field Redaction

Automatically redact sensitive personal information (SSN, identity numbers) from exports, regardless of living/deceased status. Currently, sensitive fields imported via GEDCOM v2 are stored but should never appear in exports.

### Flatten Nested Properties

Add a "Flatten" action to nested property warnings in Data Quality tab. Converts `coordinates: { lat, long }` to `coordinates_lat`, `coordinates_long`.

### Note Creation from Images

Context menu actions to create map or source notes from image files, pre-populating with image link.

### Person Note Templates

Pre-configured templates for different use cases: Researcher (full fields with sources), Casual User (minimal), World-Builder (with universe/fictional dates), Quick Add (bare minimum).

### Accessibility

- Screen reader support with ARIA labels
- High contrast mode
- Keyboard navigation
- WCAG AA compliance

### Obsidian Publish Support

Static HTML/SVG tree generation for Publish sites with privacy-aware export.

---

## Known Limitations

See [known-limitations.md](known-limitations.md) for complete details.

**Key Limitations:**
- Single vault only (no multi-vault merging)
- No undo/redo for Bases edits (platform limitation)
- No bulk operations from Bases multi-select (platform limitation)
- Privacy obfuscation for canvas display not yet implemented
- Interactive Canvas features limited by Obsidian Canvas API

### Context Menu Submenu Behavior

On desktop, submenus don't dismiss when hovering over a different submenu. This is a limitation of Obsidian's native `Menu` API. Potential solutions (flattening menus, modal dialogs, custom menu component) are under consideration based on user feedback.

---

## Contributing

We welcome feedback on feature priorities!

1. Check [existing issues](https://github.com/banisterious/obsidian-canvas-roots/issues)
2. Open a new issue with `feature-request` label
3. Describe your use case and why the feature would be valuable

See [CONTRIBUTING.md](../CONTRIBUTING.md) for development guidelines.

---

**Questions?** Open an issue on [GitHub](https://github.com/banisterious/obsidian-canvas-roots/issues).
