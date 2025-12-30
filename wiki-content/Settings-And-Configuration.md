# Settings & Configuration

This page documents all Canvas Roots settings and configuration options. Settings can be accessed in two places:

- **Obsidian Settings → Canvas Roots** - The traditional plugin settings panel
- **Control Center → Preferences** - Quick access to common settings

---

## Table of Contents

- [Control Center Overview](#control-center-overview)
- [Setting Categories](#setting-categories)
- [Property Aliases](#property-aliases)
- [Value Aliases](#value-aliases)
- [Settings Reference](#settings-reference)

---

## Control Center Overview

The Control Center (`Cmd/Ctrl+Shift+F`) is the main hub for Canvas Roots features. It has a tabbed interface:

| Tab | Description |
|-----|-------------|
| **Getting Started** | Quick start guide, essential properties reference, key concepts |
| **Tree Generation** | Generate family tree canvases from person notes |
| **People** | Browse, search, and manage person notes |
| **Places** | Manage place notes, view place hierarchy |
| **Sources** | Manage source notes and evidence |
| **Organizations** | Manage organization notes and memberships |
| **Events** | View and manage life events with timeline visualization |
| **Canvas Settings** | Layout dimensions, arrow styling, node coloring, spouse edges |
| **Schemas** | Create and run validation schemas |
| **Import/Export** | Import GEDCOM, CSV, Gramps; export data |
| **Data Quality** | Validation issues, duplicate detection, research gaps |
| **Preferences** | Folder locations, property aliases |

---

## Folder Locations

Configure where Canvas Roots stores and looks for different note types.

| Setting | Default | Description |
|---------|---------|-------------|
| **People folder** | `Canvas Roots/People` | Default folder for person notes |
| **Places folder** | `Canvas Roots/Places` | Default folder for place notes |
| **Map notes folder** | `Canvas Roots/Places/Maps` | Default folder for map notes |
| **Organizations folder** | `Canvas Roots/Organizations` | Default folder for organization notes |
| **Sources folder** | `Canvas Roots/Sources` | Default folder for source notes |
| **Events folder** | `Canvas Roots/Events` | Default folder for event notes |
| **Schemas folder** | `Canvas Roots/Schemas` | Default folder for validation schemas |
| **Canvases folder** | `Canvas Roots/Canvases` | Default folder for generated canvas files |
| **Bases folder** | `Canvas Roots/Bases` | Folder for Obsidian Bases templates |
| **Staging folder** | *(empty)* | Folder for import staging (isolated from main operations) |

### Staging Folder

The staging folder is used for importing GEDCOM/CSV files before merging into your main tree. When configured:

- Imported notes go to the staging folder first
- The staging folder is excluded from normal operations (tree generation, duplicate detection)
- You can review and merge staged notes using the Import/Export tab

Set **Enable staging isolation** to automatically exclude the staging folder from normal scans.

### Media Folders

Control which folders Canvas Roots scans when discovering media files.

| Setting | Default | Description |
|---------|---------|-------------|
| **Limit media scanning to specified folders** | Off | When enabled, only scan listed folders for media |
| **Media folders** | *(empty)* | List of folders to scan (one per line) |

When enabled, folder filtering affects:
- **Find Unlinked** results in the Media Manager
- **Media Manager statistics** (total files, coverage percentage)
- **Media picker** file lists when linking media

It does **not** affect:
- Already-linked media (always displayed regardless of location)
- **Linked Media Gallery** (shows all linked media)
- Media imported from Gramps packages

See [Media Management](Media-Management#media-folder-settings) for more details.

---

## Property Aliases

If your vault uses different property names than Canvas Roots defaults, you can create **property aliases** to map your custom names to the canonical Canvas Roots fields.

### Configuring Aliases

Go to **Control Center → Preferences → Property Aliases** to add, edit, or remove aliases.

### How Aliases Work

| Scenario | Behavior |
|----------|----------|
| **Reading notes** | Canvas Roots checks for the canonical property first, then falls back to your alias |
| **Creating/importing notes** | New notes use your aliased property name instead of the canonical name |
| **Both properties exist** | The canonical property takes precedence |

### Example

If your vault uses `birthdate` instead of `born`:

1. Add an alias: `birthdate` → `born`
2. Canvas Roots will now read `birthdate` as the birth date
3. When importing GEDCOM files, notes will be created with `birthdate` instead of `born`
4. Bases templates will use `note.birthdate` in views and formulas

### Bases Templates and Aliases

When you create a new People base template (Control Center → Advanced → Create Bases template), it will use your configured aliases:

- Column references use aliased names (e.g., `note.birthdate` instead of `note.born`)
- Filter expressions use aliased names
- Formulas reference aliased properties

> **Note:** Existing Bases files are not automatically updated when aliases change. Delete and recreate the base file to apply new alias configurations.

### Supported Properties

| Category | Properties |
|----------|------------|
| Identity | `name`, `cr_id`, `gender`, `nickname`, `maiden_name` |
| Dates | `born`, `died` |
| Places | `birth_place`, `death_place` |
| Relationships | `father`, `father_id`, `mother`, `mother_id`, `spouse`, `spouse_id`, `child`, `children_id` |
| Other | `occupation`, `universe`, `image`, `sourced_facts`, `relationships` |

---

## Value Aliases

In addition to property names, you can also create **value aliases** to map custom property values to Canvas Roots' canonical values. This is useful when your vault uses different terminology for enumerated fields.

### Configuring Value Aliases

Go to **Control Center → Preferences → Aliases → Property values** to add, edit, or remove value aliases.

### How Value Aliases Work

| Scenario | Behavior |
|----------|----------|
| **Reading notes** | Canvas Roots checks if the value is canonical first, then checks for an alias |
| **Unknown event types** | Unrecognized event types are treated as `custom` |
| **Unknown gender/place category** | Unrecognized values are passed through unchanged |

### Supported Fields

#### Event Types

Map custom event type values to canonical types:

| Canonical Value | Description | Example Aliases |
|-----------------|-------------|-----------------|
| `birth` | Birth of a person | `nameday`, `born` |
| `death` | Death of a person | `passing`, `died` |
| `marriage` | Marriage ceremony | `wedding`, `union` |
| `burial` | Burial or interment | `interment`, `funeral` |
| `residence` | Change of residence | `moved`, `relocation` |
| `occupation` | Employment change | `job`, `career` |
| `education` | Educational milestone | `school`, `graduated` |
| `military` | Military service | `service`, `enlisted` |
| `immigration` | Immigration or emigration | `moved_abroad`, `emigration` |
| `baptism` | Baptism ceremony | `christening` |
| `confirmation` | Religious confirmation | — |
| `ordination` | Religious ordination | — |
| `custom` | Custom/other event type | — |

#### Gender

Map custom gender values to canonical values:

| Canonical Value | Description | Example Aliases |
|-----------------|-------------|-----------------|
| `male` | Male | `m`, `masc`, `man` |
| `female` | Female | `f`, `fem`, `woman` |
| `nonbinary` | Non-binary | `nb`, `enby`, `other` |
| `unknown` | Unknown | `?`, `unspecified` |

> **Note:** Canvas Roots also recognizes legacy values `M` and `F` for compatibility with existing vaults.

#### Place Categories

Map custom place category values to canonical categories:

| Canonical Value | Description | Example Aliases |
|-----------------|-------------|-----------------|
| `real` | Real-world location | `actual`, `existing` |
| `historical` | Historical (no longer exists) | `former`, `past` |
| `disputed` | Disputed territory | `contested` |
| `legendary` | Legendary location | `mythical` |
| `mythological` | Mythological location | `myth` |
| `fictional` | Fictional location | `made_up`, `fantasy`, `canon` |

### Example

If your vault uses `nameday` instead of `birth` for event types:

1. Add a value alias: `nameday` → `birth` (Field: Event type)
2. Canvas Roots will now treat `event_type: nameday` as a birth event
3. Birth markers will appear on maps for events with `nameday` type

---

## Layout Settings

Control the dimensions and spacing of nodes in generated family tree canvases. These settings are also available in **Control Center → Canvas Settings** for quick access.

| Setting | Default | Description |
|---------|---------|-------------|
| **Default node width** | `200` | Width of person nodes in pixels |
| **Default node height** | `100` | Height of person nodes in pixels |
| **Horizontal spacing** | `400` | Space between nodes horizontally (multiplied by 1.5× in layout engine) |
| **Vertical spacing** | `250` | Space between generations vertically |

> **Tip:** After changing layout settings, right-click any existing canvas file and select "Regenerate canvas" to apply the new settings.

---

## Canvas Styling

Customize the appearance of generated family trees. These settings are also available in **Control Center → Canvas Settings** for quick access.

### Node Coloring

| Setting | Options | Description |
|---------|---------|-------------|
| **Node color scheme** | `gender`, `generation`, `collection`, `monochrome` | How to color person nodes |

- **Gender**: Green for male, purple for female (default)
- **Generation**: Different colors for each generation level
- **Collection**: Different colors for each collection/universe
- **Monochrome**: No coloring, neutral appearance

### Edge Styling

| Setting | Options | Description |
|---------|---------|-------------|
| **Parent-child arrow style** | `directed`, `bidirectional`, `undirected` | Arrow style for parent→child edges |
| **Spouse arrow style** | `directed`, `bidirectional`, `undirected` | Arrow style for spouse edges |
| **Parent-child edge color** | Obsidian colors or none | Color for parent→child edges |
| **Spouse edge color** | Obsidian colors or none | Color for spouse edges |

Arrow style options:
- **Directed** (→): Single arrow pointing to child/target
- **Bidirectional** (↔): Arrows on both ends
- **Undirected** (—): No arrows, just lines

### Spouse Edge Display

| Setting | Default | Description |
|---------|---------|-------------|
| **Show spouse edges** | Off | Display edges between spouses with marriage metadata |
| **Spouse edge label format** | `none` | How to display marriage information on spouse edges |

Spouse edge label format options:
- **None**: No labels on spouse edges
- **Date only**: e.g., "m. 1985"
- **Date and location**: e.g., "m. 1985 | Boston, MA"
- **Full details**: e.g., "m. 1985 | Boston, MA | div. 1992"

> **Note:** When "Show spouse edges" is disabled (default), spouses are visually grouped by positioning only, without connecting edges.

### Source Indicators

| Setting | Default | Description |
|---------|---------|-------------|
| **Show source indicators** | Off | Display source count badges on nodes (e.g., "📎 3") |

---

## Data Settings

### Auto-Generation

| Setting | Default | Description |
|---------|---------|-------------|
| **Auto-generate cr_id** | On | Automatically generate `cr_id` for person notes that don't have one |

### Bidirectional Sync

| Setting | Default | Description |
|---------|---------|-------------|
| **Enable bidirectional relationship sync** | On | Automatically maintain reciprocal relationships |
| **Sync on file modify** | On | Sync relationships when person notes are edited |

When bidirectional sync is enabled:
- Setting someone as a `father` automatically adds a `child` link in the father's note
- Works for all relationship types (parent, spouse, child)
- Supports both manual edits and Bases table edits

### Folder Filtering

Control which folders are scanned for person notes.

| Setting | Options | Description |
|---------|---------|-------------|
| **Folder filtering mode** | `disabled`, `exclude`, `include` | How to filter folders |

- **Disabled**: Scan all folders (default)
- **Exclude**: Scan all folders except those listed
- **Include**: Only scan folders in the list

When exclude or include mode is enabled, configure the folder list (one per line).

---

## Privacy Settings

Protect living persons in exports and canvas displays.

| Setting | Default | Description |
|---------|---------|-------------|
| **Enable privacy protection** | Off | Obfuscate living persons in exports |
| **Living person age threshold** | `100` | Years to assume someone is living (if no death date) |
| **Privacy display format** | `living` | How to display protected persons |
| **Hide details for living persons** | On | Hide birth dates/places for living persons |

Privacy display format options:
- **living**: Show "Living" as the name
- **private**: Show "Private" as the name
- **initials**: Show initials only (e.g., "J.S.")
- **hidden**: Exclude from output entirely

---

## Research Tools (Optional)

Advanced tools for genealogical research, aligned with the Genealogical Proof Standard.

| Setting | Default | Description |
|---------|---------|-------------|
| **Enable fact-level source tracking** | Off | Track which facts have source citations |
| **Fact coverage threshold** | `6` | Number of key facts for 100% coverage |
| **Show research gaps in status** | On | Display unsourced facts summary |

When fact-level source tracking is enabled:
- Person notes can include `sourced_facts` property
- Data Quality tab shows research coverage statistics
- Helps identify which facts need documentary evidence
- **Research level** dropdown appears in Edit Person modal
- **Research level filter** appears in Gaps Report options
- Bases views include "By research level", "Needs research", and "Not assessed"

When disabled, research level UI elements are hidden but existing `research_level` values in notes are preserved.

> **Note:** These are opt-in tools for serious researchers. Casual users can leave them disabled.

---

## Logging Settings

Configure console logging and log exports.

| Setting | Default | Description |
|---------|---------|-------------|
| **Log level** | `debug` | Verbosity of console logging |
| **Log export folder** | `.canvas-roots/logs` | Folder for exported log files |
| **Obfuscate log exports** | On | Replace PII with placeholders in exports |

Log levels (from most to least verbose):
- **Debug**: All messages
- **Info**: Important events
- **Warn**: Warnings only
- **Error**: Errors only
- **Off**: No logging

---

## Export Settings

| Setting | Default | Description |
|---------|---------|-------------|
| **Export filename pattern** | `{name}-family-chart-{date}` | Pattern for exported filenames |

Placeholders:
- `{name}`: Root person's name
- `{date}`: Current date (YYYY-MM-DD)

---

## Fictional Content Settings

Settings for working with fictional genealogies (fantasy worlds, historical fiction, etc.).

### Fictional Date Systems

| Setting | Default | Description |
|---------|---------|-------------|
| **Enable fictional dates** | On | Parse and display fictional date formats |
| **Show built-in date systems** | On | Show Middle-earth, Westeros, etc. |

Built-in systems include:
- Middle-earth (Ages of Middle-earth)
- Westeros (AC/BC - After/Before Conquest)
- Custom systems can be added

### Organization Types

| Setting | Default | Description |
|---------|---------|-------------|
| **Show built-in organization types** | On | Show noble house, guild, etc. |

### Source Types

| Setting | Default | Description |
|---------|---------|-------------|
| **Default citation format** | `evidence_explained` | Citation format for sources |
| **Show source thumbnails** | On | Show media previews in gallery |
| **Thumbnail size** | `medium` | Size of thumbnails |
| **Show built-in source types** | On | Show census, vital record, etc. |

---

## Event Settings

Settings for the Events & Timelines feature.

| Setting | Default | Description |
|---------|---------|-------------|
| **Events folder** | `Canvas Roots/Events` | Default folder for new event notes |
| **Show built-in event types** | On | Include 22 built-in event types |
| **Custom event types** | *(empty)* | User-defined event types |

### Event Types

Canvas Roots includes 22 built-in event types across four categories:

- **Core** (4): birth, death, marriage, divorce
- **Extended** (9): burial, residence, occupation, education, military, immigration, baptism, confirmation, ordination
- **Narrative** (8): anecdote, lore_event, plot_point, flashback, foreshadowing, backstory, climax, resolution

Custom event types can be added with:
- **ID**: Unique identifier (lowercase, no spaces)
- **Name**: Display name
- **Color**: Hex color for timeline displays
- **Icon**: Lucide icon name
- **Category**: `custom` (automatically assigned)

---

## Place Settings

| Setting | Default | Description |
|---------|---------|-------------|
| **Default place category** | `real` | Default category for new places |

Place categories: `real`, `historical`, `disputed`, `legendary`, `mythological`, `fictional`

Category rules can be configured to automatically set categories based on folder or collection.

---

## Relationship Types

| Setting | Default | Description |
|---------|---------|-------------|
| **Show built-in relationship types** | On | Show standard relationship types |

Custom relationship types can be added for specialized genealogical relationships.

---

## Integrations

Settings for third-party plugin integrations. The Integrations card in Control Center → Preferences only appears when supported plugins are installed.

### Calendarium Integration

If the [Calendarium](https://github.com/javalent/calendarium) plugin is installed, you can import its calendar definitions for use with fictional dates.

| Setting | Options | Description |
|---------|---------|-------------|
| **Integration mode** | `off`, `read` | Controls how Canvas Roots interacts with Calendarium |

- **Off**: No integration (default)
- **Read-only (import calendars)**: Import calendar definitions from Calendarium

When enabled, Calendarium calendars appear in:
- The Date Systems card under "From Calendarium"
- The Date system dropdown in the Create Event modal

See [Fictional Date Systems - Calendarium Integration](Fictional-Date-Systems#calendarium-integration) for details.

---

## See Also

- [Frontmatter Reference](Frontmatter-Reference) - Complete property documentation
- [Data Management](Data-Management) - Managing your family data
- [Schema Validation](Schema-Validation) - Creating validation rules
- [Geographic Features](Geographic-Features) - Place and map features
- [Fictional Date Systems](Fictional-Date-Systems) - Custom calendars and Calendarium integration
