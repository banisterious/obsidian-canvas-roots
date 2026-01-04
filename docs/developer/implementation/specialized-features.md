# Specialized Features

This document covers fictional date systems, privacy protection, and Obsidian Bases integration.

## Table of Contents

- [Fictional Date Systems](#fictional-date-systems)
  - [Date System Architecture](#date-system-architecture)
  - [FictionalDateSystem and Era Types](#fictionaldatesystem-and-era-types)
  - [Built-in Calendar Presets](#built-in-calendar-presets)
  - [DateService](#dateservice)
  - [FictionalDateParser](#fictionaldateparser)
  - [Calendarium Integration](#calendarium-integration)
  - [Control Center UI](#control-center-ui)
- [Privacy and Gender Identity Protection](#privacy-and-gender-identity-protection)
  - [Sex vs Gender Data Model](#sex-vs-gender-data-model)
  - [Living Person Privacy](#living-person-privacy)
  - [Log Export Obfuscation](#log-export-obfuscation)
  - [Pronouns Field](#pronouns-field)
  - [Private Fields](#private-fields)
  - [Privacy Feature Discoverability](#privacy-feature-discoverability)
  - [Planned Features](#planned-features-not-yet-implemented)
  - [Design Rationale](#design-rationale)
- [Obsidian Bases Integration](#obsidian-bases-integration)
  - [Base Templates](#base-templates)
  - [Computed Formulas](#computed-formulas)
  - [Property Aliases](#property-aliases)
  - [Base Creation Flow](#base-creation-flow)
  - [Control Center Integration](#control-center-integration)

---

## Fictional Date Systems

The dates module (`src/dates/`) provides support for fictional calendar systems used in world-building, historical fiction, and alternate history research. This enables parsing, display, and age calculation for dates like "TA 2941" (Third Age) or "AC 283" (After Conquest).

### Date System Architecture

The fictional dates system consists of:

```
src/dates/
├── types/
│   └── date-types.ts          # Core type definitions
├── constants/
│   └── default-date-systems.ts # Built-in calendar presets
├── parser/
│   └── fictional-date-parser.ts # Date string parsing
├── services/
│   └── date-service.ts        # Unified date handling
├── ui/
│   └── date-systems-card.ts   # Control Center UI
└── index.ts                   # Module exports
```

Integration with Calendarium plugin:
```
src/integrations/
└── calendarium-bridge.ts      # Import calendars from Calendarium
```

### FictionalDateSystem and Era Types

Core types defined in `src/dates/types/date-types.ts`:

```typescript
interface FictionalEra {
  id: string;           // Unique identifier (e.g., "third_age")
  name: string;         // Full display name (e.g., "Third Age")
  abbrev: string;       // Abbreviation for parsing (e.g., "TA")
  epoch: number;        // Year offset from system's epoch (year 0)
  direction?: 'forward' | 'backward';  // Count direction (backward for BC-style)
}

interface FictionalDateSystem {
  id: string;           // Unique identifier (e.g., "middle_earth")
  name: string;         // Display name (e.g., "Middle-earth Calendar")
  universe?: string;    // Optional universe scope
  eras: FictionalEra[]; // Eras in chronological order
  defaultEra?: string;  // Default era ID for new dates
  builtIn?: boolean;    // Whether this is a read-only preset
  source?: 'custom' | 'calendarium';  // Origin of the definition
  calendariumName?: string;           // Original name if from Calendarium
}

interface ParsedFictionalDate {
  system: FictionalDateSystem;
  era: FictionalEra;
  year: number;         // Year within the era
  raw: string;          // Original date string
  canonicalYear: number; // Absolute timeline position for sorting
}
```

**Canonical Year Calculation:**

The `canonicalYear` enables comparison across eras:
- Forward eras: `canonicalYear = epoch + year`
- Backward eras: `canonicalYear = epoch - year`

Example for Middle-earth:
- TA 2941 → canonical year 2941 (epoch 0 + 2941)
- SA 3441 → canonical year 0 (epoch -3441 + 3441)
- FoA 1 → canonical year 3022 (epoch 3021 + 1)

### Built-in Calendar Presets

Four built-in calendars in `src/dates/constants/default-date-systems.ts`:

**Middle-earth Calendar** (`middle_earth`):
| Era | Abbreviation | Epoch | Direction |
|-----|--------------|-------|-----------|
| First Age | FA | -6500 | forward |
| Second Age | SA | -3441 | forward |
| Third Age | TA | 0 | forward |
| Fourth Age | FoA | 3021 | forward |

**Westeros Calendar** (`westeros`):
| Era | Abbreviation | Epoch | Direction |
|-----|--------------|-------|-----------|
| Before Conquest | BC | 0 | backward |
| After Conquest | AC | 0 | forward |

**Star Wars Calendar** (`star_wars`):
| Era | Abbreviation | Epoch | Direction |
|-----|--------------|-------|-----------|
| Before the Battle of Yavin | BBY | 0 | backward |
| After the Battle of Yavin | ABY | 0 | forward |

**Generic Fantasy Calendar** (`generic_fantasy`):
- Four numbered ages (A1, A2, A3, A4) with 1000-year intervals

### DateService

The `DateService` class (`src/dates/services/date-service.ts`) provides unified handling for both standard ISO dates and fictional dates:

```typescript
interface DateServiceSettings {
  enableFictionalDates: boolean;
  showBuiltInDateSystems: boolean;
  fictionalDateSystems: FictionalDateSystem[];
}

class DateService {
  constructor(settings: DateServiceSettings);

  // Parse any date string (tries fictional first, then standard)
  parseDate(dateStr: string, universe?: string): ParsedDate | null;

  // Calculate age between dates
  calculateAge(birthDateStr: string, deathDateStr?: string, universe?: string): AgeCalculation | null;

  // Format a date for display
  formatDate(dateStr: string, universe?: string): string;

  // Quick check if string looks like fictional date
  looksLikeFictionalDate(dateStr: string): boolean;

  // Get canonical year for sorting
  getCanonicalYear(dateStr: string, universe?: string): number | null;
}
```

**Parse Priority:**
1. If fictional dates enabled, try `FictionalDateParser` first
2. Fall back to standard date extraction (handles YYYY-MM-DD, "about 1920", date ranges, etc.)

**Standard Date Patterns Recognized:**
- ISO format: `YYYY-MM-DD`, `YYYY`
- Approximate: `about 1920`, `circa 1850`, `c. 1900`, `~1920`
- Ranges: `1920-1930`, `between 1920 and 1930`
- Relative: `before 1920`, `after 1920`

### FictionalDateParser

The parser (`src/dates/parser/fictional-date-parser.ts`) handles era-based date strings:

```typescript
class FictionalDateParser {
  constructor(systems: FictionalDateSystem[]);

  // Parse date string with optional universe context
  parse(dateStr: string, universe?: string): DateParseResult;

  // Format parsed date back to string
  format(date: ParsedFictionalDate, options?: DateFormatOptions): string;

  // Calculate age between two fictional dates
  calculateAge(birth: ParsedFictionalDate, death: ParsedFictionalDate | null): AgeCalculation;

  // Quick check without full parsing
  looksLikeFictionalDate(dateStr: string): boolean;
}
```

**Supported Date Formats:**
- `TA 2941` - Abbreviation space year
- `TA2941` - Abbreviation directly followed by year
- `2941 TA` - Year space abbreviation
- `2941TA` - Year directly followed by abbreviation

**Era Abbreviation Index:**
The parser builds a case-insensitive index mapping abbreviations to (system, era) pairs. First system wins for duplicate abbreviations, but universe-specific matching takes priority when a `universe` parameter is provided.

**Age Calculation:**
```typescript
calculateAge(birth, death): AgeCalculation {
  const years = death.canonicalYear - birth.canonicalYear;
  return {
    years,
    isExact: true,
    display: `${years} years`
  };
}
```

### Calendarium Integration

The `CalendariumBridge` (`src/integrations/calendarium-bridge.ts`) imports calendar definitions from the Calendarium plugin:

```typescript
class CalendariumBridge {
  constructor(app: App);

  // Check if Calendarium is installed and enabled
  isAvailable(): boolean;

  // Initialize and wait for Calendarium settings to load
  async initialize(): Promise<boolean>;

  // Get list of calendar names from Calendarium
  getCalendarNames(): string[];

  // Import all calendars as FictionalDateSystem objects
  importCalendars(): FictionalDateSystem[];

  // Parse/format using Calendarium's API
  parseDate(calendarName: string, dateString: string): CalendariumDate | null;
  formatDate(calendarName: string, date: CalendariumDate): string | null;
}
```

**Calendar Conversion:**

Calendarium calendars are converted to `FictionalDateSystem` format:
- Era names become era IDs (lowercased, special chars replaced with underscores)
- Abbreviations extracted from format strings or generated from era names
- `isStartingEra` eras get epoch 0; others use their `date.year` value
- `endsYear` eras get `direction: 'backward'`

**Singleton Access:**
```typescript
const bridge = getCalendariumBridge(app);
await bridge.initialize();
const systems = bridge.importCalendars();
```

### Control Center UI

The date systems card (`src/dates/ui/date-systems-card.ts`) provides management UI:

**Enable Toggle:**
- Master toggle for fictional date parsing
- Stored in `settings.enableFictionalDates`

**Built-in Systems Toggle:**
- Show/hide preset calendars (Middle-earth, Westeros, Star Wars, Generic Fantasy)
- Stored in `settings.showBuiltInDateSystems`

**System Sources Display:**
Three groups shown in the list:
1. **Built-in systems** - Read-only table with view button
2. **From Calendarium** - Imported calendars (read-only)
3. **Custom systems** - User-defined with edit/delete actions

**Add/Edit Modal (`DateSystemModal`):**
- Name and auto-generated ID fields
- Optional universe scope
- Eras table with name, abbreviation, epoch, direction
- Default era dropdown
- Validation: unique ID, at least one era, unique abbreviations

**Test Parsing Input:**
Live validation input that shows:
- Era name and year
- System name
- Canonical year for sorting

**Settings Storage:**
```typescript
// In CanvasRootsSettings
enableFictionalDates: boolean;
showBuiltInDateSystems: boolean;
fictionalDateSystems: FictionalDateSystem[];
calendariumIntegration: 'off' | 'read';
```

---

## Privacy and Gender Identity Protection

The plugin supports inclusive gender identity modeling and privacy protection for sensitive data.

### Sex vs Gender Data Model

The frontmatter supports three distinct fields (defined in `src/types/frontmatter.ts`):

```yaml
sex: M                          # GEDCOM-compatible biological sex (M/F/X/U)
gender: male                    # Legacy field, falls back to sex when reading
gender_identity: Non-binary     # Free-form gender identity field
```

**Field usage:**

| Field | Purpose | Used By |
|-------|---------|---------|
| `sex` | Biological sex for GEDCOM compatibility | Import/export, Data Quality normalization, Canvas coloring |
| `gender` | Backwards compatibility | Falls back to `sex` when reading |
| `gender_identity` | Personal identity (free-form) | Display only (not used in data interchange) |

**Canvas node coloring** (`src/core/canvas-generator.ts` - `getPersonColor()`):
- Reads `sex` field from frontmatter
- M/MALE → Green (color 4)
- F/FEMALE → Purple (color 6)
- NONBINARY → Yellow (color 3)
- Unknown → Orange (color 2)
- Falls back to name prefix detection (Mr., Mrs., etc.) for legacy support

**Data Quality sex normalization** (`src/core/data-quality.ts` - `normalizeGenderValues()`):
- Standardizes values to GEDCOM M/F/X/U format
- Uses built-in synonyms (male→M, female→F, etc.)
- Supports user-defined value aliases via settings
- Three modes controlled by `settings.sexNormalizationMode`:
  - `standard` - Normalize all values to GEDCOM M/F/X/U
  - `schema-aware` - Skip notes with schemas defining custom sex values
  - `disabled` - No normalization

### Living Person Privacy

The `PrivacyService` (`src/core/privacy-service.ts`) protects living individuals in exports:

**Detection logic:**
1. **Manual override** (`cr_living` frontmatter property):
   - `cr_living: true` — Always treat as living (protected)
   - `cr_living: false` — Always treat as deceased (not protected)
   - When omitted, automatic detection is used
2. **Automatic detection** (when `cr_living` not set):
   - Person is "likely living" if: no death date AND birth year within age threshold
   - Default threshold: 100 years (configurable via `settings.livingPersonAgeThreshold`)
   - Supports approximate dates: "about 1920", "between 1920-1930", "before 1920"

**Protection display options** (`settings.privacyDisplayFormat`):

| Option | Display | Behavior |
|--------|---------|----------|
| `living` | "Living" | Show placeholder name |
| `private` | "Private" | Show placeholder name |
| `initials` | "J.S." | Show initials only |
| `hidden` | (excluded) | Remove from output entirely |

**What gets protected in exports:**
- **Name**: Replaced with chosen display format
- **Birth/death dates**: Hidden when `hideDetailsForLiving` is enabled
- **Relationships**: Preserved (allows tree structure to remain intact)
- **Original notes**: Unchanged (protection applies to outputs only)

**Applied in exports:**
- GEDCOM export (`src/gedcom/gedcom-exporter.ts`)
- GEDCOM X export (`src/gedcomx/gedcomx-exporter.ts`)
- Gramps XML export (`src/gramps/gramps-exporter.ts`)
- CSV export (`src/csv/csv-exporter.ts`)
- Canvas generation (`src/core/canvas-generator.ts`) - when enabled in wizard

**Not yet applied to:**
- Interactive family chart view
- Reports (markdown output)

For user-facing documentation, see [Privacy & Security](../../wiki-content/Privacy-And-Security.md).

### Log Export Obfuscation

The logging system (`src/core/logging.ts`) includes built-in PII obfuscation for log exports, protecting personal data when sharing logs for debugging.

**Setting:** `settings.obfuscateLogExports` (default: `true` - secure by default)

**What gets obfuscated:**

| Pattern | Replacement | Example |
|---------|-------------|---------|
| Names (capitalized multi-word) | `[NAME-1]`, `[NAME-2]`, etc. | "John Smith" → `[NAME-1]` |
| ISO dates | `[DATE]` | "1985-03-15" → `[DATE]` |
| Years (1000-2029) | `[YEAR]` | "born in 1952" → "born in `[YEAR]`" |
| File paths (`.md`) | `/[FILE].md` | "/People/John Smith.md" → `/[FILE].md` |
| UUIDs/cr_ids | `[ID]` | "abc12345-..." → `[ID]` |

**Implementation functions:**
- `obfuscateString(str)` - Replaces PII patterns in a string
- `obfuscateData(data)` - Recursively obfuscates objects/arrays
- `obfuscateLogEntry(entry)` - Obfuscates a single log entry (preserves technical fields like component, category, level)
- `obfuscateLogs(logs)` - Obfuscates an array of log entries

**Usage in settings UI** (`src/settings.ts`):
```typescript
const logsToExport = this.plugin.settings.obfuscateLogExports
  ? obfuscateLogs(logs)
  : logs;
```

**Design notes:**
- Names are replaced with consistent numbered tokens (`[NAME-1]`, `[NAME-2]`) within each log entry to preserve reference relationships
- Numbers and booleans pass through unchanged (safe technical data)
- Component and category names are preserved (technical identifiers, not PII)

### Pronouns Field

The frontmatter supports a `pronouns` property for respectful communication:

```yaml
pronouns: she/her   # Free-form string
```

**Display behavior:**
- Controlled by `settings.showPronouns` (default: enabled)
- Shown in person pickers after name in parentheses: "Jane Smith (she/her)"
- Included in reports (Markdown, ODT, PDF)
- Editable via Edit Person modal

**Implementation:**
- Added to `PersonNode` interface in `src/core/family-graph.ts`
- Extracted from frontmatter in `buildPersonNode()`
- Passed to person picker modals and report generators

### Private Fields

Users can mark specific frontmatter fields as private using the `private_fields` property:

```yaml
name: Alex Johnson
previous_names:
  - Alexandra Johnson
private_fields:
  - previous_names
```

**Implementation** (`src/core/privacy-service.ts`):
- `scanForPrivateFields(people)` - Scans people for private fields, returns summary for warnings
- `filterPrivateFields(data, privateFields)` - Removes private fields from export data
- `PrivateFieldSummary` interface - Tracks field names and affected person counts

**Export behavior:**
- Before export, `scanForPrivateFields()` checks if any people have private fields
- If found, `PrivateFieldsWarningModal` shows a confirmation dialog
- Users can choose to include, exclude, or cancel the export
- When excluded, private field values are removed from export output

**Common use cases:**
- Deadname protection via `previous_names` + `private_fields`
- Medical notes, legal information, personal details

### Privacy Feature Discoverability

To help users discover privacy features, the plugin provides contextual notices:

**Post-import notice** (`src/ui/privacy-notice-modal.ts`):
- Shown after import when living persons detected and privacy protection disabled
- Offers: "Configure Privacy Settings", "Remind Me Later", "Don't Show Again"
- Controlled by `settings.privacyNoticeDismissed` (persists dismiss choice)

**Export preview notice** (`src/ui/export-wizard-modal.ts`):
- Shown in Step 4 preview when privacy disabled but living persons will be exported
- Links directly to privacy configuration in settings

### Canvas Privacy Protection

Canvas generation supports privacy-aware output through the unified tree wizard.

**Enabling in wizard:**
1. In Step 4 (Canvas options), expand "Privacy protection" section
2. Enable "Apply privacy protection to living persons"
3. Choose format: "Text node" (obfuscated) or "File node" (clickable but reveals identity)

**Implementation** (`src/core/canvas-generator.ts`):
- `CanvasGenerationOptions.applyCanvasPrivacy` - Enable privacy protection
- `CanvasGenerationOptions.canvasPrivacyFormat` - Choose 'text' or 'file' output
- `setPrivacyService(service)` - Inject privacy service before generation
- `createPrivacyProtectedNode()` - Creates obfuscated text nodes for protected persons

**Text node format:**
```
**Living**

[[Original Filename]]

_Privacy protected_
```

The wikilink provides navigation back to the original note while keeping the displayed name obfuscated.

**Preview integration:**
The wizard preview (Step 5) shows count of privacy-protected persons when privacy is enabled.

**Known limitations:**
| Limitation | Description |
|------------|-------------|
| File nodes reveal identity | When using 'file' format, filename in canvas JSON is visible |
| Wikilinks in text nodes | Text nodes include wikilinks for navigation, which contain original filename |
| Canvas JSON not encrypted | Canvas files store node data in plain JSON |
| No runtime protection | Privacy applied at generation time only; Obsidian Canvas API has no hooks |
| Shared canvases | If canvas file is shared, privacy-protected nodes are still visible to recipients |
| Edges remain | Relationship edges connect to protected nodes, preserving tree structure |

**Planned features (not yet implemented):**
- Interactive family chart view privacy
- Report (markdown) privacy

### Design Rationale

- Separates GEDCOM biological data from personal identity
- Supports inclusive gender identity while maintaining data interchange compatibility
- Protects living persons from inadvertent disclosure in exports
- Respects user-defined schemas that may have custom sex/gender values

---

## Obsidian Bases Integration

Canvas Roots generates `.base` files for Obsidian's database-like Bases feature (Obsidian 1.9.0+), providing pre-configured table views for genealogical data.

### Base Templates

Six base templates are available in `src/constants/`:

| Base | Template File | Key Properties | Views |
|------|--------------|----------------|-------|
| People | `base-template.ts` | name, cr_id, born, died, father, mother, spouse | 22 views |
| Places | `places-base-template.ts` | name, place_type, coordinates, parent_place | 11 views |
| Events | `events-base-template.ts` | title, event_type, date, person, place | 18 views |
| Sources | `sources-base-template.ts` | name, source_type, confidence, media | 15 views |
| Organizations | `organizations-base-template.ts` | name, org_type, parent_org, founded | 12 views |
| Universes | `universes-base-template.ts` | name, status, author, genre | 10 views |

**Template structure:**
```yaml
visibleProperties: [...]
summaries: {...}
filters: {...}
formulas: {...}
properties: {...}
views: [...]
```

**Data type identification:** Bases filter by `cr_type` property:
- People base: `cr_type == "person"`
- Places base: `cr_type == "place"`
- etc.

### Computed Formulas

Templates include computed properties using Obsidian's formula syntax:

**People base examples:**
```typescript
// Age calculation (respects livingPersonAgeThreshold)
age: 'if(${born}.isEmpty(), "Unknown",
      if(${died}.isEmpty() && (now() - ${born}).years.floor() < ${maxLivingAge},
         (now() - ${born}).years.floor() + " years",
         if(${born} && !${died}.isEmpty(),
            (${died} - ${born}).years.floor() + " years", "Unknown")))'

// Display name fallback
display_name: '${name} || file.name'
```

**Places base examples:**
```typescript
// Combine coordinates
coordinates: 'if(${coordinates_lat}, ${coordinates_lat} + ", " + ${coordinates_long}, "")'

// Map link generation
map_link: 'if(${coordinates_lat}, "[[Map View]]", "")'
```

### Property Aliases

Base templates respect user-defined property aliases, so custom property names work automatically.

**Implementation pattern:**
```typescript
function generatePeopleBaseTemplate(options?: {
    aliases?: Record<string, string>;
    maxLivingAge?: number;
}): string {
    const getPropertyName = (canonical: string) =>
        options?.aliases?.[canonical] || canonical;

    const name = getPropertyName('name');
    const born = getPropertyName('born');
    // Use in formulas: age: `if(\${${born}}.isEmpty(), ...)`
}
```

**Settings:** `settings.propertyAliases` maps custom names to canonical names.

**Current support:**
- People, Places, Events bases: Full alias support
- Organizations, Sources, Universes: Static templates (no alias support yet)

### Base Creation Flow

**Commands registered in `main.ts`:**
- `canvas-roots:create-base-template` - People base
- `canvas-roots:create-places-base-template` - Places base
- `canvas-roots:create-events-base-template` - Events base
- `canvas-roots:create-sources-base-template` - Sources base
- `canvas-roots:create-organizations-base-template` - Organizations base
- `canvas-roots:create-universes-base-template` - Universes base
- `canvas-roots:create-all-bases` - All bases at once

**Creation logic:**
1. **Check availability** (`isBasesAvailable()`): Looks for existing `.base` files or enabled Bases plugin
2. **User confirmation**: If Bases not detected, prompts user (file will work once enabled)
3. **Folder creation**: Creates `basesFolder` (default: `Canvas Roots/Bases`)
4. **File creation**: Creates `.base` file with generated template, opens in editor
5. **Template generation**: Applies property aliases and settings

**Auto-creation during import:**
When importing GEDCOM/CSV, bases are auto-created for imported note types (silently skips if already exist).

### Control Center Integration

The Preferences tab includes a "Base templates" card with:
- Individual buttons for each base type
- "Create all bases" button
- Icons and descriptions for each base
