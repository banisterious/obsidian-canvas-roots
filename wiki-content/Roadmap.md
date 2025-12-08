# Roadmap

This document outlines planned features for Canvas Roots. For completed features, see [Release History](Release-History). For version-specific changes, see the [GitHub Releases](https://github.com/banisterious/obsidian-canvas-roots/releases).

---

## Table of Contents

- [Completed Features](#completed-features)
- [Planned Features](#planned-features)
  - [Calendarium Integration](#calendarium-integration) 📋 Medium
  - [Export v2: Full Entity Export](#export-v2-full-entity-export) ⚡ High
  - [Data Enhancement Pass](#data-enhancement-pass) ⚡ High
  - [Print & PDF Export](#print--pdf-export) 📋 Medium
  - [Research & Analysis Tools](#research--analysis-tools) 📋 Medium
  - [Transcript Nodes & Oral History](#transcript-nodes--oral-history) 💡 Low
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

Features are prioritized to complete the data lifecycle: **import → enhance → export/share**.

| Priority | Label | Description |
|----------|-------|-------------|
| ⚡ High | Core workflow | Completes essential data portability |
| 📋 Medium | User value | Highly requested sharing/output features |
| 💡 Low | Specialized | Advanced use cases, niche workflows |

---

### Calendarium Integration

**Priority:** 📋 Medium — Unified timeline experience for fictional worldbuilders

**Summary:** Deep integration with the [Calendarium](https://plugins.javalent.com/calendarium) plugin to enable shared calendar definitions, bidirectional event sync, and cross-calendar date translation. Particularly valuable for worldbuilders using fictional date systems.

**Integration Modes:**

| Mode | Description | Use Case |
|------|-------------|----------|
| Standalone | Canvas Roots manages its own calendars | Users without Calendarium |
| Calendarium Primary | Canvas Roots reads Calendarium calendars | Existing Calendarium users |
| Bidirectional | Full sync between both plugins | Power users wanting unified experience |

**Planned Features:**
- **Calendar Sharing:** Import calendar definitions from Calendarium, eliminating duplicate configuration
- **Event Sync:** Display Calendarium events on Canvas Roots timelines
- **Bidirectional Sync:** Create events in either plugin, sync to the other
- **Cross-Calendar Translation:** Convert dates between different calendar systems (e.g., Third Age to real-world dates)

**Data Mapping:**

| Canvas Roots Field | Calendarium Field |
|--------------------|-------------------|
| `fictional_date` | `fc-date` |
| `calendar_system` | `fc-calendar` |
| `event_category` | `fc-category` |
| `display_name` | `fc-display-name` |

**Settings:**
- `calendariumIntegration`: off / read-only / bidirectional
- `calendariumDefaultCalendar`: Which calendar to use when creating events
- `syncCalendariumEvents`: Whether to show Calendarium events on timelines

**API Integration:** Uses `window.Calendarium` global when available, with graceful fallback when Calendarium is not installed.

See [Calendarium Integration Planning Document](https://github.com/banisterious/obsidian-canvas-roots/blob/main/docs/planning/calendarium-integration.md) for implementation details.

---

### Export v2: Full Entity Export

**Priority:** ⚡ High — Completes import/export round-trip with GEDCOM Import v2

**Summary:** Enhanced export functionality that includes events, sources, places, and media in addition to person notes. Ensures round-trip fidelity with GEDCOM Import v2 and enables complete data portability.

**Current Limitation:** All four exporters (GEDCOM 5.5.1, GEDCOM X, Gramps XML, CSV) only export person notes. Event notes, source notes, place notes, and media files created by Import v2 are lost on export.

**Planned Features:**
- **Event Export:** Export all event notes linked to persons (30+ event types)
- **Source Export:** Export source notes with citations linked to events
- **Place Export:** Export place hierarchy with coordinates
- **Media Export:** Bundle media files (images, documents, audio) in ZIP archive
- **GEDCOM 7.0 Support:** Modern format with native media embedding
- **Format-specific mappings:** GEDCOM tags, GEDCOM X facts, Gramps XML events
- **Sensitive field redaction:** SSN and identity numbers automatically removed
- **UI enhancements:** Checkboxes to include/exclude entity types and media options
- **Enhanced export experience:** Progress modal with real-time feedback, export preview with entity counts, and export history tracking

**Supported Formats:**
| Format | Events | Sources | Places | Media |
|--------|--------|---------|--------|-------|
| GEDCOM 5.5.1 | ✅ inline tags | ✅ SOUR records | ✅ PLAC hierarchy | ⚠️ limited OBJE |
| GEDCOM 7.0 | ✅ inline tags | ✅ SOUR records | ✅ PLAC records | ✅ full OBJE support |
| GEDCOM X | ✅ person facts | ✅ sourceDescriptions | ✅ placeDescriptions | ✅ artifacts |
| Gramps XML | ✅ event records | ✅ source records | ✅ placeobj records | ✅ objects |
| CSV | ✅ event rows | ✅ source rows | ✅ place rows | ✅ media rows |

See [Export v2 Planning Document](https://github.com/banisterious/obsidian-canvas-roots/blob/main/docs/planning/export-v2.md) for implementation details.

---

### Data Enhancement Pass

**Priority:** ⚡ High — Enables existing users to benefit from new entity types

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

**Priority:** 📋 Medium — Tangible output for sharing with family members

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

**Priority:** 📋 Medium — Analytics and tracking for serious researchers

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

**Priority:** 💡 Low — Specialized for oral history researchers

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
