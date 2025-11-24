# Canvas Roots Plugin - Technical Specification

> **ARCHIVED:** This document was archived on 2025-11-24 as it represents a v2.0 draft specification that was never implemented. The plugin went in a different direction using the family-chart library instead of D3.js, and many planned features described here were not developed.
>
> **For current technical documentation, see:**
> - [README.md](../README.md) - User guide and feature overview
> - [User Guide](../user-guide.md) - Complete workflow documentation
> - [Roadmap](../roadmap.md) - Released and planned features
> - [Development Guide](../development.md) - Architecture and implementation details

**Version:** 2.0
**Last Updated:** 2025-11-20
**Status:** Draft (Archived)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Data Model](#2-data-model)
3. [Core Features](#3-core-features)
4. [Technical Implementation](#4-technical-implementation)
5. [GEDCOM Integration](#5-gedcom-integration)
6. [Enhanced Relationship Modeling](#6-enhanced-relationship-modeling)
7. [World-Building and Organizational Features](#7-world-building-and-organizational-features)
8. [Multi-Family Tree UX Enhancements](#8-multi-family-tree-ux-enhancements)

---

## 1. Overview

### 1.1 Purpose

Canvas Roots is an Obsidian plugin that automates the creation and layout of complex family trees within Obsidian Canvas, using structured note data as the source and D3.js-based layout algorithms for positioning.

### 1.2 Key Differentiators

- **Native Canvas Integration:** Renders family trees as native Obsidian Canvas nodes and edges, not embedded visualizations
- **D3.js Layout Engine:** Leverages powerful graph layout algorithms for automatic positioning
- **Full Customization:** Users can manually adjust any node after automatic layout
- **Bidirectional Linking:** Maintains relationship consistency across all person notes
- **GEDCOM Compatibility:** Import and export standard genealogical data formats

### 1.3 Core Workflow

```
User creates person notes with relationship links
           ↓
User runs "Generate Tree" command on Canvas
           ↓
Plugin calculates D3 layout coordinates
           ↓
Plugin renders nodes/edges to Canvas JSON
           ↓
User views and customizes the family tree
```

---

## 2. Data Model

### 2.1 Person Note Schema

Each person in the family tree is represented by an individual Markdown note with YAML frontmatter or inline fields (Dataview compatible).

#### 2.1.1 Core Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `cr_id` | String (UUID) | **Yes** | Unique identifier for the person. Auto-generated on note creation. |
| `name` | String | No | Display name (defaults to file title) |
| `father` | [[Link]] | No | Link to father's note file |
| `mother` | [[Link]] | No | Link to mother's note file |
| `spouse` | [[Link]] or Array | No | Link(s) to spouse(s)/partner(s) |
| `children` | Array<[[Link]]> | No | Links to children's note files (auto-maintained by bidirectional linking) |
| `born` | Date | No | Birth date (see §6.4 for format details) |
| `died` | Date | No | Death date (see §6.4 for format details) |
| `cr_living` | Boolean | No | Explicitly mark if person is living (overrides auto-detection for obfuscation) |
| `cr_root` | Boolean | No | Marks person as tree center (optional filter) |
| `sex` | String | No | Biological sex (GEDCOM: M/F/U) for data compatibility and color coding |
| `gender` | String | No | Gender identity (free-form, e.g., "Woman", "Non-binary", "Transgender man") |
| `pronouns` | String | No | Preferred pronouns (e.g., "she/her", "they/them", "he/him") |
| `_previous_names` | Array<String> | No | Historical names (underscore prefix = private/sensitive data, see §2.1.2) |

#### 2.1.2 Privacy and Identity Protection

**Gender and Identity:** Canvas Roots respects the distinction between biological sex (relevant for GEDCOM data interchange and medical history) and gender identity (a person's authentic self-identification). The plugin supports both fields independently:

- **`sex`**: Used for GEDCOM compatibility and optional color coding in canvas visualizations. Supports standard GEDCOM values: M (male), F (female), U (unknown/unspecified). This field is optional and should reflect biological sex as recorded in genealogical records, not gender identity.
- **`gender`**: Free-form text field for recording gender identity. Examples: "Woman", "Man", "Non-binary", "Genderfluid", "Transgender woman", etc. This field takes precedence for display purposes and respectful language in UI.
- **`pronouns`**: Optional field for preferred pronouns to ensure respectful reference in documentation, exports, and custom reports.

**Visual Representation:** When color coding is enabled, the canvas generator uses the `sex` field by default for backward compatibility with GEDCOM data. Future versions will support user preference settings to color by `gender`, `sex`, or disable color coding entirely.

**Deadname Protection:** The `name` field always represents the person's current, chosen name. Historical names should **never** be displayed as the primary name. If historical names must be preserved for genealogical record-keeping:

- Use the `_previous_names` field (underscore prefix indicates private/sensitive data)
- The plugin **will not display** underscore-prefixed fields in UI, search results, or standard exports
- When exporting to GEDCOM or other formats, users will be warned if private fields are included
- Documentation and UI language will emphasize dignity and respect for chosen names

**Privacy Field Convention:** Any field prefixed with an underscore (`_`) is considered private or sensitive:

- **Never displayed** in person picker, search results, or canvas labels
- **Excluded by default** from exports and reports
- **Requires explicit user confirmation** if included in data exchange formats
- Examples: `_previous_names`, `_medical_notes`, `_adoption_details`

**Inclusive Language:** All documentation, UI text, and code comments use inclusive language that respects diverse gender identities and family structures. The plugin is designed to serve all users regardless of their gender identity, sexual orientation, or family composition.

#### 2.1.3 Extended Properties (See §6)

Additional properties for complex genealogical data:
- Multiple spouse tracking with metadata (§6.1)
- Alternative parent relationships (§6.2)
- Unknown parent markers (§6.3)
- Flexible date formats (§6.4)
- Child ordering fields (§6.5)
- Grandparent direct links (§6.7)
- Relationship quality metadata (§6.8)
- Medical and genetic information (§6.9)
- Location and migration tracking (§6.10)

#### 2.1.4 Reference Numbering Systems (Optional)

**Overview:** Reference numbering systems provide human-readable, hierarchical identifiers that encode genealogical relationships and positions within family trees. These complement the machine-level `cr_id` UUID system by offering intuitive labeling for research organization, file management, and print reports.

**Dual-Identity System:**

| Property | Purpose | Format | Example | Required |
|----------|---------|--------|---------|----------|
| `cr_id` | Machine identity for merging, persistence, technical operations | UUID v4 | `abc-123-def-456` | Yes |
| `cr_ref_num` | Human-readable position for sorting, labeling, printing | System-dependent | `12.3`, `24.0*2`, `5/3.0` | No |

**Supported Systems:**

##### Dollarhide-Cole Numbering System

**Format:** `[tree_prefix/]number[.number]*[*marriage_order]`

**Key Components:**
- **Direct Ancestors:** End in `.0` (e.g., `12.0` = root's father)
- **Siblings:** Numbered `.1`, `.2`, `.3`, etc., based on birth order (eldest = `.1`)
- **Spouses:** Append `*` with marriage order (e.g., `12.3*2` = second spouse)
- **Descendants:** Append new number (e.g., `12.3` → first child is `12.3.1`)
- **Multiple Trees:** Use `/` separator (e.g., `5/3.0` = tree 5, person 3, direct ancestor)

**Birth Order Handling:**
- **Known order:** Use sequential numbers (`.1`, `.2`, `.3`)
- **Unknown order:** Use alphabetical by first name OR use `.u1`, `.u2`, `.u3` (unknown)
- **Twins/Multiples:** Same number with letter suffix (`.1a`, `.1b`) OR sequential if order is known

**Examples:**

```yaml
# Root person
---
cr_id: root-uuid
cr_ref_num: "1"
name: Starting Person
---

# Root's father (direct ancestor)
---
cr_id: father-uuid
cr_ref_num: "2.0"
name: Father of Root
---

# Root's mother (direct ancestor)
---
cr_id: mother-uuid
cr_ref_num: "3.0"
name: Mother of Root
---

# Root's eldest sibling
---
cr_id: sibling1-uuid
cr_ref_num: "1.1"
name: Eldest Sibling
---

# Root's second sibling (root is third child)
---
cr_id: sibling2-uuid
cr_ref_num: "1.2"
name: Second Sibling
---

# Root's first spouse
---
cr_id: spouse1-uuid
cr_ref_num: "1*1"
name: First Spouse
---

# Root's second spouse
---
cr_id: spouse2-uuid
cr_ref_num: "1*2"
name: Second Spouse
---

# Root's first child with first spouse
---
cr_id: child1-uuid
cr_ref_num: "1.1"
name: First Child
father: "[[Starting Person]]"  # cr_ref_num: "1"
mother: "[[First Spouse]]"     # cr_ref_num: "1*1"
---

# Grandchild (first child's eldest child)
---
cr_id: grandchild1-uuid
cr_ref_num: "1.1.1"
name: First Grandchild
---

# Multiple trees example: Second family tree, person 3, direct ancestor
---
cr_id: tree2-person-uuid
cr_ref_num: "2/3.0"
name: Person from Second Tree
---
```

**Canvas Display Integration:**

Reference numbers are displayed on canvas nodes when enabled:

```
┌─────────────────────────────┐
│ [12.3] John Robert Smith    │  ← Reference number in brackets
│ 1888-1952                   │
│                             │
│ Father: [24.0] John Sr      │
│ Mother: [25.0] Jane Doe     │
└─────────────────────────────┘
```

**Settings Configuration:**

```yaml
reference_numbering:
  enabled: true
  system: "dollarhide-cole"     # Options: "dollarhide-cole", "ahnentafel", "custom"

  root_person: "[[Starting Person]]"

  # Canvas display options
  display_on_canvas: true
  display_format: "[{ref_num}] {name}"  # Bracket style
  # OR: "{ref_num} - {name}"           # Dash style
  # OR: "{name} ({ref_num})"           # Parenthetical

  # File naming suggestions
  show_in_filename_suggestions: true
  filename_template: "{ref_num} - {name}.md"  # "12.3 - John Robert Smith.md"

  # Generation strategy
  auto_calculate: "suggest"     # Options: "manual", "suggest", "automatic"
  # "manual": User assigns all numbers manually
  # "suggest": Plugin suggests numbers, user can edit
  # "automatic": Plugin auto-assigns and updates

  # Birth order handling
  unknown_birth_order_strategy: "alphabetical"  # Options: "alphabetical", "unknown_suffix"
  # "alphabetical": Sort by first name (A=.1, B=.2, etc.)
  # "unknown_suffix": Use .u1, .u2, .u3 for unknown order

  # Multiple trees
  allow_multiple_trees: true
  tree_separator: "/"

  # Display preferences
  show_on_person_detail_panel: true
  editable_in_panel: true       # Allow editing ref_num in detail panel
```

##### Ahnentafel Numbering System

**Format:** Simple integer sequence based on mathematical relationship.

**Rules:**
- Root person: `1`
- Father of person `n`: `2n`
- Mother of person `n`: `2n + 1`

**Examples:**

```yaml
# Root
cr_ref_num: "1"

# Father
cr_ref_num: "2"

# Mother
cr_ref_num: "3"

# Paternal grandfather
cr_ref_num: "4"

# Paternal grandmother
cr_ref_num: "5"

# Maternal grandfather
cr_ref_num: "6"

# Maternal grandmother
cr_ref_num: "7"
```

**Advantages:** Mathematically predictable, compact for ancestor trees.

**Limitations:** Only works for direct ancestors (no siblings, descendants, or spouses).

##### Custom Numbering Systems

**Format:** User-defined pattern.

**Configuration:**

```yaml
reference_numbering:
  system: "custom"
  custom_pattern: "{generation}-{family_line}-{individual}"
  # Example: "G3-Smith-001"
```

**Use Cases:**
- Institutional archives (e.g., `ARCH-FAM-001`)
- Research projects with specific naming conventions
- Integration with existing paper-based filing systems

#### GEDCOM Export Integration

Reference numbers are exported using the standard `REFN` (Reference Number) tag:

```gedcom
0 @I001@ INDI
1 _UUID abc-123-def-456
1 REFN 12.3
2 TYPE Dollarhide-Cole
1 NAME John Robert /Smith/
1 BIRT
2 DATE 15 MAY 1888
```

**On Import:** If a GEDCOM file contains `REFN` tags, the plugin offers to:
1. Import reference numbers as-is
2. Recalculate based on selected system and root person
3. Ignore reference numbers

#### Generation and Calculation

**Automatic Calculation Triggers:**
- New person note created with relationship to existing person
- Relationship fields modified (father, mother, spouse, child)
- Root person changed in settings
- User runs "Recalculate Reference Numbers" command

**Calculation Algorithm (Dollarhide-Cole):**

1. Start from root person (ref_num = "1")
2. Traverse relationships depth-first
3. For each person:
   - If direct ancestor: append `.0`
   - If sibling: append `.1`, `.2`, etc. based on birth order
   - If spouse: append `*1`, `*2`, etc. based on marriage order
   - If descendant: append new generation number
4. Handle cycles by detecting already-numbered persons
5. Mark conflicts for manual resolution

**Edge Cases:**

- **Multiple paths to same person:** Use shortest path OR path through root's direct lineage
- **Missing birth dates:** Use alphabetical order or unknown suffix
- **Disconnected persons:** Assign new tree prefix (e.g., `2/1`) OR leave unnumbered
- **Cycles in relationships:** Detect and warn user, prevent infinite loops

#### User Interface

**Commands:**
- `Canvas Roots: Assign Reference Numbers` - Calculate for entire vault
- `Canvas Roots: Recalculate Reference Numbers` - Recalculate based on current settings
- `Canvas Roots: Clear Reference Numbers` - Remove all `cr_ref_num` properties
- `Canvas Roots: Set Root Person for Reference Numbering` - Choose new root

**Detail Panel Integration:**

```
┌─────────────────────────────────────┐
│ Person Details                      │
├─────────────────────────────────────┤
│ Reference Number: [12.3    ] [↻]   │  ← Editable with recalculate button
│ UUID: abc-123-def-456               │
│ Name: John Robert Smith             │
│ ...                                 │
└─────────────────────────────────────┘
```

**File Renaming Suggestions:**

When `show_in_filename_suggestions: true`, the plugin suggests renaming files based on reference numbers:

```
┌─────────────────────────────────────────────────┐
│ Reference Number Updated                        │
├─────────────────────────────────────────────────┤
│ John Robert Smith.md → 12.3 - John Robert Smith.md │
│                                                 │
│ [Skip]  [Rename This File]  [Rename All (23)]  │
└─────────────────────────────────────────────────┘
```

#### Use Cases

**Research Organization:**
- Sort person notes by reference number to mirror printed genealogy charts
- Quickly identify generation and family line from filename
- Maintain consistent numbering across digital and paper records

**Print Reports:**
- Export family trees with reference numbers matching professional genealogy standards
- Create indexes and tables of contents using reference numbers
- Cross-reference between narrative reports and charts

**Collaborative Research:**
- Share consistent person identifiers with research partners
- Reference specific individuals in correspondence without ambiguity
- Maintain numbering across multiple researchers' vaults (when using same root and system)

**File Management:**
- Organize hundreds of person notes with hierarchical file naming
- Sort files to keep family groups together
- Quickly locate individuals by position in tree (e.g., "I need the 3rd child of person 12")

**Canvas Navigation:**
- Quickly identify person's position in tree at a glance
- Use reference numbers as visual anchors when zooming/panning large trees
- Filter canvas to show only specific number ranges (e.g., "show me generation 3: all .x.x.x")

#### Implementation Priority

Reference numbering systems are planned for **Phase 2** (enhancement features), after core tree generation and layout are stable.

### 2.2 Bidirectional Link Automation

**Requirement:** The plugin must automatically maintain inverse relationships when primary relationships are created or modified.

**Examples:**
- When `father: [[John Smith]]` is added to Jane's note → ensure `children: [[Jane Doe]]` exists in John's note
- When `spouse: [[Jane Doe]]` is added to John's note → ensure `spouse: [[John Smith]]` exists in Jane's note

**Implementation:** This feature is part of the MVP and must be implemented before 1.0 release.

---

## 3. Core Features

### 3.1 Tree Generation Command

**Command:** `Canvas Roots: Generate Tree for Current Note`

**Trigger Context:** User views a person note (the "root person")

**Activation Methods:**
1. **Command Palette:** Run command while viewing person note
2. **File Context Menu:** Right-click on person note → "Generate Family Tree"
   - Opens Control Center modal
   - Pre-selects person as root in Tree Generation tab
   - User can adjust settings before generating

**Actions:**
1. Recursively fetch all connected person notes (ancestors and descendants)
2. Extract relationship data from note properties
3. Build graph data structure
4. Calculate layout using D3.js algorithm
5. Generate Canvas JSON nodes and edges
6. Write to active Canvas file

### 3.2 Re-Layout Command

**Command:** `Canvas Roots: Re-Layout Current Canvas`

**Purpose:** Re-run layout calculation on existing Canvas nodes to snap them back to D3-calculated positions after manual rearrangement.

**Actions:**
1. Read existing Canvas JSON
2. Match Canvas nodes to person notes via file paths
3. Recalculate D3 layout positions
4. Update node coordinates without duplicating

### 3.3 Person Detail Panel

**Requirement:** Provide a dedicated sidebar panel for viewing and editing person data with live sync to the source note's frontmatter.

#### 3.3.1 Panel Overview

**Purpose:**
- Quick access to person data without opening full note
- In-place editing of YAML frontmatter properties
- Seamless integration with Obsidian Bases workflow
- Live synchronization between panel, note, and Bases table

**Panel Location:** Right sidebar (configurable in settings)

**Activation:**
- **Command:** `Canvas Roots: Open Person Detail Panel`
- **Context menu:** Right-click person node on canvas → "View Person Details"
- **Keyboard shortcut:** Configurable hotkey
- **Auto-open:** Optional setting to open when clicking canvas nodes

#### 3.3.2 Panel Components

**Header Section:**

```
┌─────────────────────────────────────────┐
│ 👤 John Robert Smith                    │
│ [Open Note] [Close] [⋮ More]           │
├─────────────────────────────────────────┤
```

**Actions:**
- **Open Note Button:** Opens source note in editor
- **Open in New Pane:** Split view option
- **Link to Canvas Node:** Scroll canvas to highlight person
- **More Menu:** Copy `cr_id`, export person data, etc.

**Editable Fields:**

Display all core properties as editable form fields:

```
┌─────────────────────────────────────────┐
│ Basic Information                       │
├─────────────────────────────────────────┤
│ Name:        [John Robert Smith       ] │
│ Born:        [1888-05-15              ] │
│ Died:        [1952-08-20              ] │
│ Living:      ☐ (auto-detected)          │
├─────────────────────────────────────────┤
│ Relationships                           │
├─────────────────────────────────────────┤
│ Father:      [[John Smith Sr]]    [🔗]  │
│ Mother:      [[Jane Doe]]         [🔗]  │
│ Spouse(s):   [[Mary Jones]]       [🔗]  │
│              [+ Add Spouse]             │
│ Children:    [[Bob Smith]]        [🔗]  │
│              [[Alice Smith]]      [🔗]  │
│              (auto-maintained)          │
├─────────────────────────────────────────┤
│ Research Notes                          │
├─────────────────────────────────────────┤
│ [Rendered markdown content from note    │
│  body with wikilinks active...          │
│                                         │
│  - Source: [[Census 1920]]             │
│  - Found in Boston records             │
│  ]                                      │
├─────────────────────────────────────────┤
│ [Edit Full Note]                        │
└─────────────────────────────────────────┘
```

**Field Types:**

| Field Type | UI Component | Behavior |
|------------|--------------|----------|
| **Text** | Text input | Direct edit, saves on blur |
| **Date** | Date picker + text | Supports flexible formats (§6.4) |
| **Wikilink** | Link with navigate button | Click to open linked note |
| **Array** | List with add/remove | Manage multiple values |
| **Boolean** | Checkbox | Toggle true/false |
| **Enum** | Dropdown | Predefined choices |

#### 3.3.3 Data Source Integration

**Frontmatter Binding:**

All edits modify the source note's YAML frontmatter directly:

```yaml
---
cr_id: abc-123-def-456
name: John Robert Smith
father: "[[John Smith Sr]]"
mother: "[[Jane Doe]]"
spouse: ["[[Mary Jones]]"]
born: 1888-05-15
died: 1952-08-20
---

# Research Notes

- Source: [[Census 1920]]
- Found in Boston records
```

**Live Sync:**
- **Panel → Note:** Edits immediately update note frontmatter
- **Note → Panel:** Panel updates when note is edited externally
- **Bases → Panel:** Changes in Bases table reflect in panel
- **Panel → Bases:** Panel edits appear in Bases table view

**File Watcher:** Monitor source note for external changes and refresh panel

#### 3.3.4 Markdown Rendering

**Research Notes Field:**

Display a dedicated section for note body content:

**Features:**
- **Markdown rendering:** Full CommonMark support
- **Wikilink activation:** Clickable `[[links]]` to other notes
- **Embed support:** Show `![[embeds]]` inline
- **Read-only display:** Note body shown but not editable in panel
- **Scroll area:** Scrollable if content exceeds panel height
- **Character limit:** Show first 500 chars with "Read more" expansion

**Implementation:**
- Use Obsidian's built-in markdown renderer
- Extract note body (content after frontmatter)
- Render in isolated div with proper styling

#### 3.3.5 Multi-Person Support

**Navigation:**

When multiple people are selected or viewed:

```
┌─────────────────────────────────────────┐
│ [◀ Prev] John Robert Smith [Next ▶]    │
│ Person 2 of 5 in selection              │
└─────────────────────────────────────────┘
```

**History Stack:**
- Track previously viewed persons
- Back/forward navigation buttons
- Recent persons dropdown

#### 3.3.6 Settings

**Panel Configuration:**

```yaml
person_detail_panel:
  default_location: right    # left, right, bottom
  auto_open_on_click: true   # Open when clicking canvas nodes
  fields_displayed:          # Customizable field list
    - name
    - born
    - died
    - father
    - mother
    - spouse
    - children
  show_note_body: true       # Display markdown research notes
  note_body_char_limit: 500  # Preview character limit
  enable_inline_editing: true # Edit fields in panel vs. note
```

**Field Display Order:**
- Drag-to-reorder in settings
- Hide/show individual fields
- Group fields by category (Basic, Relationships, Extended)

#### 3.3.7 Advanced Features

**Quick Actions:**

- **Add Child:** Create new child note with automatic relationship
- **Add Spouse:** Create new spouse note with bidirectional link
- **Add Parent:** Create or link to parent notes
- **Duplicate Person:** Copy data to new note for similar entries
- **Export Person:** Export individual to GEDCOM snippet

**Validation:**

- **Required fields:** Highlight missing `cr_id`
- **Date validation:** Warn about invalid date formats
- **Broken links:** Flag missing `[[wikilinks]]`
- **Circular relationships:** Detect and warn about impossible relationships

**Conflict Resolution:**

If note is edited externally while panel is open:

```
┌─────────────────────────────────────────┐
│ ⚠️ Note Modified Externally             │
│                                         │
│ The source note has been changed.       │
│                                         │
│ [Reload Panel] [Keep Local Changes]    │
└─────────────────────────────────────────┘
```

#### 3.3.8 Use Cases

**Quick Data Entry:**
- Fill in person details without opening full note editor
- Faster than switching between Canvas and note editor
- Ideal for bulk data entry sessions

**Bases Integration:**
- View person details while working in Bases table
- Cross-reference between Canvas visualization and table data
- Verify relationships while editing in table view

**Research Workflow:**
- View research notes while analyzing Canvas tree
- Quick access to sources and documentation
- One-click navigation to related persons

**Validation:**
- Review all person data in structured format
- Identify missing or incorrect information
- Fix broken relationships

### 3.4 Collections and Dataset Management

**Requirement:** Enable users to organize, browse, and work with multiple family trees and research projects within a single vault, supporting both automatic detection and optional manual organization.

> **Note:** For complete architectural details, see [docs/architecture/collections.md](../architecture/collections.md)

#### 3.4.1 Overview

**Purpose:**
- Automatically detect and work with multiple disconnected family trees (zero configuration)
- Optionally organize person notes into user-defined collections
- Switch between different datasets seamlessly
- Track family component statistics
- Support both genealogy and world-building use cases

**Design Philosophy:**

Canvas Roots uses a **Smart Hybrid Approach** with two parallel collection systems:

1. **Detected Components** (automatic, zero-config)
   - Computed from relationship graph using BFS traversal
   - Works for all users regardless of vault organization
   - No folders, tags, or configuration required
   - Self-healing (always reflects current relationship data)

2. **User Collections** (optional, manual)
   - User-assigned collection property in person note frontmatter
   - For power users who want custom organization
   - Works alongside detected components
   - Stored as simple YAML property

**Key Constraint:** Many Obsidian users do not use folders or tags, and do not wish to. Canvas Roots must work perfectly for flat vaults with zero configuration.

#### 3.4.2 Detected Family Components

**What Are Detected Components?**

Family components are disconnected graphs discovered by analyzing relationships between person notes. If two people have no path of relationships connecting them, they belong to different components.

**Data Model:**

```typescript
/**
 * A detected family component (computed, not stored)
 */
export interface FamilyComponent {
  // Component index (0-based, sorted by size descending)
  index: number;  // 0, 1, 2...

  // Display name from user-provided group_name or auto-generated
  displayName: string;  // "Smith Family Tree" or "Family 1"

  // Number of people in this component
  size: number;

  // All people in this component
  people: PersonNode[];

  // Representative person (oldest by birth, or first alphabetically)
  representative: PersonNode;
}
```

**Detection Algorithm:**

```typescript
class FamilyGraphService {
  /**
   * Detect all family components using BFS graph traversal
   * @returns Components sorted by size (largest first)
   */
  async getFamilyComponents(): Promise<FamilyComponent[]> {
    // Use existing findAllFamilyComponents() implementation
    const components = await this.findAllFamilyComponents();

    return components.map((comp, index) => {
      // Look for user-provided custom name
      const customName = this.findCollectionName(comp.people);

      return {
        index,
        displayName: customName || `Family ${index + 1}`,
        size: comp.size,
        people: comp.people,
        representative: comp.representative
      };
    });
  }

  private findCollectionName(people: PersonNode[]): string | null {
    // Scan frontmatter for group_name property
    const names = people
      .map(p => this.getPropertyFromFrontmatter(p.file, 'group_name'))
      .filter(n => n);

    if (names.length === 0) return null;
    if (names.length === 1) return names[0];

    // Multiple names - pick most common or first alphabetically
    const counts = names.reduce((acc, name) => {
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.keys(counts)
      .sort((a, b) => counts[b] - counts[a] || a.localeCompare(b))[0];
  }
}
```

**YAML Properties for Naming:**

Users can optionally name their family components by adding `group_name` to person notes:

```yaml
---
cr_id: "abc-123"
name: "John Smith"
group_name: "Smith Family Tree"  # Optional component name
---
```

**Naming Rules:**
- If no one in component has `group_name`: Auto-generate "Family 1", "Family 2", etc.
- If 1+ people have same `group_name`: Use that name
- If people have different names: Use most common, break ties alphabetically

**Key Property: Component Membership is COMPUTED**

Component membership is **never stored** in person notes. It is always derived from current relationships by running BFS traversal.

**Why?**
- Prevents stale data (always reflects current relationships)
- Zero maintenance (no manual updating needed)
- Self-healing (adding/removing relationships automatically updates components)
- Obsidian Bases compatible (users can edit relationships, components recompute)

**How Users Control Component Membership:**

Users control which component a person belongs to by **editing their relationships**, not by editing a stored component ID:

```yaml
# To move "Sarah Jones" from Family 1 to Family 2:
# 1. Remove relationships connecting her to Family 1 members
# 2. Add relationships connecting her to Family 2 members
# 3. Components recompute automatically on next access
```

#### 3.4.3 User Collections (Optional)

**What Are User Collections?**

User collections are optional, user-defined groupings stored in person note frontmatter. They provide an additional organizational layer for power users.

**Data Model:**

```typescript
/**
 * A user-defined collection (stored in frontmatter)
 */
export interface UserCollection {
  // Collection name from 'collection' property
  name: string;  // "Paternal Line", "House Stark", etc.

  // All people with this collection value
  people: PersonNode[];
}

/**
 * Person node with optional collection assignment
 */
export interface PersonNode {
  crId: string;
  name: string;
  // ... existing fields ...

  // Optional user-assigned collection
  userCollection?: string;  // From 'collection' property
}
```

**YAML Property:**

```yaml
---
cr_id: "abc-123"
name: "John Smith"
collection: "Paternal Line"  # Optional user collection
---
```

**Use Cases:**

1. **Genealogy:** Organize by research focus
   - `collection: "Paternal Line"`
   - `collection: "Maternal Line"`
   - `collection: "Colonial Massachusetts"`

2. **World-Building:** Organize by faction/house
   - `collection: "House Stark"`
   - `collection: "Night's Watch"`
   - `collection: "Wildlings"`

**Relationship to Detected Components:**

User collections and detected components are **independent**:

```
Example vault:
- Detected Components: [Family 1 (8 people), Family 2 (5 people)]
- User Collections: [Paternal Line (6 people), Maternal Line (7 people)]

Family 1 members might be split across both user collections
User collection members might be split across multiple family components
```

**Obsidian Bases Integration:**

The `collection` property appears as an editable text field in Bases table view:

| name | cr_id | collection | born |
|------|-------|------------|------------|
| John Smith | abc-123 | Paternal Line | 1950-05-10 |
| Mary Jones | def-456 | Maternal Line | 1952-08-15 |

Users can bulk-edit collections using Bases drag-down fill or find-replace.

#### 3.4.4 Cross-Collection Connections

**Detected Components:**

By definition, detected components are disconnected (no relationship path between them). If relationships exist between two components, they merge into one component.

**User Collections:**

User collections can have connections via "bridge people" with cross-collection relationships:

```typescript
/**
 * Connection between two user collections
 */
export interface CollectionConnection {
  fromCollection: string;  // "House Stark"
  toCollection: string;    // "House Targaryen"
  bridgePeople: PersonNode[];  // People with relationships to both
  relationshipCount: number;   // Total cross-collection relationships
}
```

**Detection Algorithm:**

```typescript
async findCollectionConnections(): Promise<CollectionConnection[]> {
  const connections: Map<string, CollectionConnection> = new Map();

  for (const person of this.getAllPeople()) {
    const personCollection = person.userCollection;
    if (!personCollection) continue;

    // Check all relationships for cross-collection links
    for (const relationship of this.getAllRelationships(person)) {
      const relatedCollection = relationship.target.userCollection;

      if (relatedCollection && relatedCollection !== personCollection) {
        const key = [personCollection, relatedCollection].sort().join('|');

        if (!connections.has(key)) {
          connections.set(key, {
            fromCollection: personCollection,
            toCollection: relatedCollection,
            bridgePeople: [],
            relationshipCount: 0
          });
        }

        const conn = connections.get(key)!;
        if (!conn.bridgePeople.find(p => p.crId === person.crId)) {
          conn.bridgePeople.push(person);
        }
        conn.relationshipCount++;
      }
    }
  }

  return Array.from(connections.values());
}
```

**Use Case: Political Alliances (World-Building)**

```yaml
# Sansa Stark marries Tyrion Lannister
---
name: "Sansa Stark"
collection: "House Stark"
spouses:
  - "[[Tyrion Lannister]]"
---

# Tyrion Lannister
---
name: "Tyrion Lannister"
collection: "House Lannister"
spouses:
  - "[[Sansa Stark]]"
---
```

This creates a cross-collection connection:
- From: House Stark
- To: House Lannister
- Bridge people: [Sansa Stark, Tyrion Lannister]
- Relationship count: 1 (marriage)

#### 3.4.5 Implementation Phases

**Phase 1: Component Naming (v0.2.0-beta)**

**Status:** Planned for next release

**Scope:**
- Add `group_name` property support
- Update UI to show custom names instead of "Family 1", "Family 2"
- Naming conflict resolution (most common name wins)
- Documentation for users

**No Breaking Changes:**
- Detected components continue to work as-is
- Custom names are optional enhancement
- Zero configuration still works perfectly

---

**Phase 2: User Collections (v0.3.0-beta)**

**Status:** Planned

**Scope:**
- Add `collection` property support
- UI to filter/browse by user collection
- Collection statistics in Status tab
- Obsidian Bases integration testing
- Cross-collection connection detection

**Features:**
- Filter person picker by collection
- "Collection:" dropdown in tree generation
- Statistics: "Paternal Line: 45 people across 2 family components"
- Bases template includes `collection` column

---

**Phase 3: Advanced Collection Features (v1.x.x)**

**Status:** Future

**Scope:**
- Cross-collection tree generation (show relationships between collections)
- Collection-level GEDCOM export (export only one collection)
- Collection merge/split tools
- Collection-specific styling (color-code nodes by collection)
- Reference numbering with collection codes (§2.1.4)

#### 3.4.6 UI Integration

**Current UI (v0.1.1):**

Tree Generation tab already shows detected components in sidebar:

```
┌──────────────────────────────────────────┐
│ Tree Generation                          │
├──────────────────────────────────────────┤
│ ┌─────────┬──────────────────────────┐  │
│ │ All     │ Root person:             │  │
│ │ families│ [Select person...     ▼] │  │
│ ├─────────┤                          │  │
│ │ Family 1│ • John Smith (1950)      │  │
│ │    8    │ • Mary Jones (1952)      │  │
│ ├─────────┤ • Robert Smith (1975)    │  │
│ │ Family 2│                          │  │
│ │    5    │                          │  │
│ └─────────┴──────────────────────────┘  │
└──────────────────────────────────────────┘
```

**Phase 1 Enhancement:**

Show custom names when `group_name` is present:

```
┌──────────────────────────────────────────┐
│ Tree Generation                          │
├──────────────────────────────────────────┤
│ ┌──────────────┬───────────────────────┐ │
│ │ All families │ Root person:          │ │
│ ├──────────────┤ [Select person...  ▼] │ │
│ │ Smith Family │ • John Smith (1950)   │ │
│ │     8        │ • Mary Jones (1952)   │ │
│ ├──────────────┤ • Robert Smith (1975) │ │
│ │ Jones Family │                       │ │
│ │     5        │                       │ │
│ └──────────────┴───────────────────────┘ │
└──────────────────────────────────────────┘
```

**Phase 2 Enhancement:**

Add collection filter dropdown:

```
┌──────────────────────────────────────────┐
│ Tree Generation                          │
├──────────────────────────────────────────┤
│ Filter by:                               │
│ ○ Family component  [Smith Family     ▼] │
│ ○ User collection   [Paternal Line    ▼] │
│ ○ All people                             │
│                                          │
│ Root person:                             │
│ [Select person...                     ▼] │
│                                          │
│ • John Smith (1950)                      │
│ • Mary Jones (1952)                      │
│ • Robert Smith (1975)                    │
└──────────────────────────────────────────┘
```

#### 3.4.7 Use Cases

**Use Case 1: Zero Configuration (Current)**

A user with a flat vault and no folder/tag organization:
1. Import GEDCOM (creates person notes in default folder)
2. Plugin automatically detects 3 disconnected family components
3. UI shows "Family 1 (12 people)", "Family 2 (8 people)", "Family 3 (5 people)"
4. User can immediately generate trees for each component
5. No configuration, naming, or organization required

**Use Case 2: Custom Component Names (Phase 1)**

A genealogist researching two main family lines:
1. Add `group_name: "Smith Paternal Line"` to Smith family members
2. Add `group_name: "Jones Maternal Line"` to Jones family members
3. UI updates to show custom names instead of "Family 1", "Family 2"
4. Person notes remain in flat structure (no folders required)

**Use Case 3: User Collections for Research Focus (Phase 2)**

A researcher organizing by research focus:
1. Assign `collection: "Primary Research"` to actively researched people
2. Assign `collection: "Verified"` to fully documented people
3. Assign `collection: "Needs Sources"` to people requiring citation work
4. Filter person picker by collection to focus work
5. Generate trees showing only "Needs Sources" people

**Use Case 4: World-Building with Noble Houses (Phase 2)**

A fiction writer organizing a fantasy world:
1. Create people for House Stark, House Lannister, House Targaryen
2. Assign `collection: "House Stark"`, etc. to each person
3. All houses might be one detected component (if marriages connect them)
4. But user collections provide faction-based organization
5. Generate "House Stark" tree, "House Lannister" tree, or combined tree
6. Plugin detects cross-collection marriages as political alliances

**Use Case 5: Obsidian Bases Bulk Editing (Phase 2)**

A user managing large datasets:
1. Open person notes in Bases table view
2. See `collection` column (text field)
3. Use Bases features: sort, filter, drag-down fill, find-replace
4. Bulk-assign collections to 50+ people in seconds
5. Canvas Roots respects all changes (collections are just YAML properties)
6. Generate trees with updated collection assignments

### 3.5 Tree Visualization Modes

**Requirement:** Provide dual-mode visualization supporting both interactive D3 preview and native Obsidian Canvas rendering with full editing capabilities.

#### 3.5.1 Overview

**Purpose:**
- Enable rapid iteration and exploration using D3 interactive preview
- Generate final trees to native Obsidian Canvas for full editability
- Provide seamless transition between preview and Canvas modes
- Maintain WYSIWYG consistency (preview matches Canvas output)

**Design Philosophy:**
- D3 mode = fast, interactive, read-only preview for layout refinement
- Canvas mode = native Obsidian Canvas with full editing capabilities
- Shared layout engine ensures consistency between modes

#### 3.5.2 Visualization Modes

**Mode 1: D3 Interactive Preview (Tree View)**

A custom Obsidian view type for interactive tree exploration:

```typescript
// View registration
this.registerView(
  TREE_VIEW_TYPE,
  (leaf) => new TreeView(leaf, this)
);

// View state
interface TreeViewState {
  collection: string;  // Collection ID
  tree: string;        // Tree ID
  rootPerson: string;  // cr_id of root
  layoutOptions: LayoutOptions;
}
```

**Features:**
- Full-screen D3 SVG rendering
- Interactive zoom/pan
- Click to select nodes
- Hover for quick info
- Real-time layout adjustment with settings panel
- "Export to Canvas" button
- **Read-only** (does not modify source notes or Canvas files)

**UI Structure:**

```
┌─────────────────────────────────────────────────────────┐
│ Tree View: Smith Family - Main Line                 [⚙️] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│         [Interactive D3 SVG Tree Visualization]         │
│         - Zoom/pan enabled                              │
│         - Click nodes to select                         │
│         - Hover for tooltips                            │
│                                                         │
│ Collection: Smith Family (SMI)                          │
│ Tree: Main Line (1) - 180 people, 4 generations         │
│                                                         │
│ [⚙️ Layout Settings] [Generate to Canvas] [Export PNG] │
└─────────────────────────────────────────────────────────┘
```

**Layout Settings Panel (Sidebar):**

```
┌─────────────────────────────┐
│ Layout Settings             │
├─────────────────────────────┤
│ Algorithm: [D3 Tree  ▼]     │
│                             │
│ Node Dimensions:            │
│ Width:  [====░░] 300px      │
│ Height: [====░░] 150px      │
│                             │
│ Spacing:                    │
│ Horizontal: [====░░] 200px  │
│ Vertical:   [====░░] 150px  │
│                             │
│ Orientation:                │
│ ○ Vertical (ancestors up)   │
│ ● Horizontal (left-to-right)│
│                             │
│ Generations:                │
│ Ancestors:   [===░░] 3      │
│ Descendants: [===░░] 2      │
│                             │
│ [Reset to Defaults]         │
│ [Preview Changes]           │
└─────────────────────────────┘
```

**Commands:**
- `Canvas Roots: Open Tree View` - Opens Tree View for active person note
- `Canvas Roots: Open Tree View for Collection` - Shows collection picker first

**Mode 2: Native Canvas View**

Standard Obsidian Canvas with optional Canvas Roots enhancements:

**Option A: Pure Canvas (Minimal Enhancement)**

User works with standard `.canvas` files:
- Open any `.canvas` file normally in Obsidian
- All native Canvas features available
- Canvas Roots adds commands to generate/re-layout trees
- No custom UI wrapper needed

**Commands:**
- `Canvas Roots: Generate Tree to Canvas` - Writes tree to active Canvas
- `Canvas Roots: Re-Layout Canvas` - Recalculates positions for existing nodes

**Option B: Enhanced Canvas View (Future)**

Custom leaf view that wraps native Canvas with dataset browser:

```
┌─────────────────────────────────────────────────────────┐
│ Canvas Roots: Smith-Main-Tree.canvas                [⚙️] │
├──────────────┬──────────────────────────────────────────┤
│ Dataset      │  [Native Obsidian Canvas View]           │
│ Browser      │  - Full Canvas editing capabilities      │
│              │  - Drag nodes to reposition              │
│ Collections  │  - Resize nodes                          │
│ ○ Smith (SMI)│  - Add/remove nodes manually             │
│ ○ Jones (JON)│  - Create edges                          │
│              │  - All Canvas context menus              │
│ Trees        │  - Native Canvas keyboard shortcuts      │
│ ● Main (1)   │                                          │
│ ○ Ext (2)    │  Viewing: Smith Family > Main Line       │
│              │  Generated: 2025-11-19 10:30             │
│ Quick Access │                                          │
│ Recent       │  [Re-Layout] [Export] [Settings]         │
│ · John Smith │                                          │
└──────────────┴──────────────────────────────────────────┘
```

**Important:** The Canvas area is **native Obsidian Canvas**, not a custom renderer. All standard Canvas features work exactly as expected:
- Full editing capabilities
- All native Canvas interactions
- Standard Canvas file format
- Compatible with other Canvas plugins
- Canvas Roots only adds optional UI wrapper and commands

#### 3.5.3 Shared Layout Engine

Both visualization modes use the **same layout calculation engine** to ensure WYSIWYG consistency:

```typescript
// src/core/layout-engine.ts

export class LayoutEngine {
  /**
   * Calculate node positions using D3 algorithms
   * Used by both D3 preview and Canvas generation
   */
  calculateLayout(
    graph: FamilyGraph,
    options: LayoutOptions
  ): LayoutResult {
    // D3 tree/hierarchy calculations
    // Returns coordinates for all nodes
    // Same algorithm used for preview and Canvas output
  }
}

// Usage in D3 preview
const layout = layoutEngine.calculateLayout(graph, options);
d3Renderer.renderToSVG(layout);  // Draw to SVG

// Usage in Canvas generation
const layout = layoutEngine.calculateLayout(graph, options);
canvasGenerator.writeToCanvas(layout);  // Write to .canvas JSON
```

**Benefit:** What user sees in D3 preview is **exactly** what will be generated to Canvas.

#### 3.5.4 Canvas File Metadata

**Status:** ✅ **IMPLEMENTED** (2025-11-22)

Canvas files generated by Canvas Roots include embedded metadata in the standard Obsidian Canvas `metadata.frontmatter` field. This enables intelligent re-layout with preserved settings.

**Implemented Format:**

```json
{
  "nodes": [ /* ... canvas nodes ... */ ],
  "edges": [ /* ... canvas edges ... */ ],
  "metadata": {
    "version": "1.0-1.0",
    "frontmatter": {
      "plugin": "canvas-roots",
      "generation": {
        "rootCrId": "vvz-870-oee-253",
        "rootPersonName": "Thomas Wilson",
        "treeType": "full",
        "maxGenerations": 5,
        "includeSpouses": true,
        "direction": "vertical",
        "timestamp": 1763832272682
      },
      "layout": {
        "nodeWidth": 200,
        "nodeHeight": 100,
        "nodeSpacingX": 300,
        "nodeSpacingY": 200
      }
    }
  }
}
```

**Metadata Schema (`CanvasRootsMetadata`):**

| Field | Type | Description |
|-------|------|-------------|
| `plugin` | `'canvas-roots'` | Plugin identifier for metadata validation |
| `generation.rootCrId` | `string` | Root person's cr_id |
| `generation.rootPersonName` | `string` | Root person's display name |
| `generation.treeType` | `'full' \| 'ancestors' \| 'descendants'` | Type of tree generated |
| `generation.maxGenerations` | `number` | Generation limit (0 = unlimited) |
| `generation.includeSpouses` | `boolean` | Whether spouses were included |
| `generation.direction` | `'vertical' \| 'horizontal'` | Layout direction |
| `generation.timestamp` | `number` | Unix timestamp of generation |
| `layout.nodeWidth` | `number` | Canvas node width in pixels |
| `layout.nodeHeight` | `number` | Canvas node height in pixels |
| `layout.nodeSpacingX` | `number` | Horizontal spacing between nodes |
| `layout.nodeSpacingY` | `number` | Vertical spacing between nodes |

**Benefits:**
- ✅ Re-layout command preserves tree type, generations, and spouse inclusion settings
- ✅ Re-layout modal displays original generation settings to user
- ✅ Enables changing layout direction while preserving all other settings
- ✅ Audit trail with generation timestamp
- ✅ Compatible with Obsidian Canvas JSON specification
- ✅ Future-proof for canvas versioning and migration

**Implementation Details:**
- Metadata embedded at generation time in both Control Center and "Generate All Trees" command
- Stored in standard Obsidian Canvas `metadata.frontmatter` field as `Record<string, unknown>`
- TypeScript interface `CanvasRootsMetadata` defines schema in `src/core/canvas-generator.ts`
- Re-layout reads metadata and passes to canvas generator via `canvasRootsMetadata` option
- Uses TypeScript literal types (`as const`) for type safety

#### 3.5.5 Mode Switching Workflow

**Primary Workflow: Preview → Canvas**

```
1. User opens Control Center
2. Selects collection and tree
3. Clicks "Preview Tree" → Opens D3 Tree View
4. Adjusts layout settings with real-time preview
5. Satisfied with layout
6. Clicks "Generate to Canvas"
7. Plugin writes to .canvas file
8. Opens Canvas in native Obsidian Canvas view
9. User manually edits as needed
```

**Secondary Workflow: Direct to Canvas**

```
1. User opens person note
2. Runs command: "Generate Tree to Canvas"
3. Plugin uses default settings
4. Writes directly to .canvas file
5. No preview step needed
```

**Re-Layout Workflow:**

```
1. User has existing .canvas file with tree
2. Made manual adjustments to node positions
3. Wants to restore calculated layout
4. Runs command: "Re-Layout Canvas"
5. Plugin reads canvas-roots metadata
6. Recalculates layout with original settings
7. Updates node positions
8. User can manually adjust again
```

#### 3.5.6 Implementation Components

**Core Classes:**

```typescript
// D3 rendering for preview
export class D3TreeRenderer {
  renderToSVG(container: HTMLElement, layout: LayoutResult): void;
  updateLayout(layout: LayoutResult): void;  // Live updates
  destroy(): void;
}

// Canvas file generation
export class CanvasGenerator {
  writeToCanvas(
    canvasPath: string,
    layout: LayoutResult,
    metadata: CanvasRootsMetadata
  ): Promise<void>;

  updateNodePositions(
    canvasPath: string,
    layout: LayoutResult
  ): Promise<void>;
}

// Shared layout calculation
export class LayoutEngine {
  calculateLayout(
    graph: FamilyGraph,
    options: LayoutOptions
  ): LayoutResult;
}

// Tree view component
export class TreeView extends ItemView {
  getViewType(): string { return TREE_VIEW_TYPE; }
  getDisplayText(): string { return 'Family Tree'; }

  async onOpen(): Promise<void> {
    // Render D3 tree
    // Add settings panel
    // Add export button
  }
}
```

**Commands:**

| Command | Description | Context |
|---------|-------------|---------|
| `Open Tree View` | Open D3 preview for current person | Person note active |
| `Open Tree View for Collection` | Choose collection/tree to preview | Any context |
| `Generate Tree to Canvas` | Write tree directly to Canvas | Person note or Tree View |
| `Re-Layout Canvas` | Recalculate existing Canvas layout | Canvas file active |

#### 3.5.7 Phase Implementation

**MVP (Phase 1):**
- ✅ Layout engine with D3 calculations
- ✅ Canvas generation (direct output)
- ✅ Basic commands (Generate, Re-Layout)
- ✅ Canvas metadata support

**Phase 2:**
- ✅ Tree View with D3 preview
- ✅ Settings panel with live preview
- ✅ Export to Canvas from Tree View
- ✅ Collection/tree context in Tree View

**Phase 3:**
- ✅ Enhanced Canvas View with dataset browser
- ✅ Mode switching UI
- ✅ Canvas view shows collection context

**Phase 4+:**
- ✅ Advanced preview features (filters, highlights)
- ✅ Multiple layout algorithms
- ✅ Animation between layouts

### 3.6 Control Center Modal

**Requirement:** Provide a centralized, Material Design-based modal interface for accessing all Canvas Roots features, settings, and operations.

#### 3.6.1 Overview

**Purpose:**
- Unified interface for all plugin operations
- Visual feedback and status monitoring
- Contextual settings and controls
- Professional, consistent user experience

**Activation:**
- **Command:** `Canvas Roots: Open Control Center`
- **Ribbon icon:** Optional persistent access
- **Keyboard shortcut:** Configurable hotkey

**Implementation File:** `src/ui/control-center.ts`

#### 3.6.2 Architecture

**Design Pattern:** Modal with navigation drawer and tabbed content area

**Inspired by:** Sonigraph plugin's Material Control Panel (`control-panel.ts`)

**Key Components:**

```typescript
// Main modal class
class ControlCenterModal extends Modal {
  private activeTab: string;
  private drawer: HTMLElement;         // Navigation sidebar
  private contentContainer: HTMLElement; // Tab content area
  private appBar: HTMLElement;         // Sticky header
}
```

**UI Structure:**

```
┌─────────────────────────────────────────────────────┐
│ [X]  Canvas Roots Control Center    [Actions...]   │ ← Sticky Header
├──────────┬──────────────────────────────────────────┤
│ Status   │  Tab Content Area                        │
│ Actions  │  (Dynamic content based on active tab)   │
│ Data     │                                           │
│ Tree     │  Cards, forms, buttons, etc.             │
│ GEDCOM   │                                           │
│ Person   │                                           │
│ Advanced │                                           │
└──────────┴──────────────────────────────────────────┘
   Drawer       Content
```

#### 3.6.3 Tab Configurations

**Tab Structure:**

| Tab ID | Name | Icon | Purpose |
|--------|------|------|---------|
| `status` | Status | `activity` | Vault statistics, data quality report |
| `quick-actions` | Quick Actions | `zap` | Primary commands (Generate Tree, Re-Layout, etc.) |
| `quick-settings` | Canvas Settings | `settings` | Canvas layout and arrow styling settings |
| `data-entry` | Data Entry | `user-plus` | Create new person notes with relationship linking |
| `tree-generation` | Tree Generation | `git-branch` | Tree type, filters, and generation options |
| `gedcom` | GEDCOM | `file-text` | Import/export operations, merge tools |
| `person-detail` | Person Details | `user` | Person Detail Panel settings and quick access |
| `advanced` | Advanced | `settings` | Reference numbering, obfuscation, advanced features |

**Configuration Format:**

```typescript
const TAB_CONFIGS = [
  {
    id: 'status',
    name: 'Status',
    icon: 'activity',
    description: 'Vault statistics and health checks'
  },
  {
    id: 'quick-actions',
    name: 'Quick Actions',
    icon: 'zap',
    description: 'Frequently used commands'
  },
  // ... etc
];
```

#### 3.6.4 Tab Content Specifications

##### Status Tab

**Purpose:** Display vault-wide statistics and data quality metrics

**Content Sections:**

1. **Vault Statistics Card:**
   ```
   ┌─────────────────────────────────────┐
   │ Vault Statistics                    │
   ├─────────────────────────────────────┤
   │ Total People:        247            │
   │ Total Families:      89             │
   │ Relationship Links:  612            │
   │ Average Generations: 4.2            │
   │ Date Range:          1847-2024      │
   └─────────────────────────────────────┘
   ```

2. **Data Quality Card:**
   ```
   ┌─────────────────────────────────────┐
   │ Data Quality Report                 │
   ├─────────────────────────────────────┤
   │ ✓ Complete Records:    215 (87%)    │
   │ ⚠ Missing cr_id:       5 (2%)       │
   │ ⚠ Broken Links:        12 (5%)      │
   │ ⚠ Circular Relations:  0 (0%)       │
   │                                     │
   │ [View Details] [Validate Vault]    │
   └─────────────────────────────────────┘
   ```

3. **Recently Generated Trees Card:** *(Implemented 2025-11-20)*
   ```
   ┌─────────────────────────────────────┐
   │ Recently Generated Trees            │
   ├─────────────────────────────────────┤
   │ Family Tree - Smith Family          │
   │ Root: James Smith                   │
   │ 👥 163 people  🔗 287 edges  🕐 2h ago│
   │                                     │
   │ Family Tree - Jones Ancestors       │
   │ Root: Mary Jones                    │
   │ 👥 27 people  🔗 48 edges  🕐 1 day ago│
   │                                     │
   │ [... up to 10 most recent trees]    │
   └─────────────────────────────────────┘
   ```
   - Clickable tree names open the canvas file
   - Shows root person used for generation
   - Displays people count and edge count
   - Relative timestamps (e.g., "2 hours ago", "just now")
   - Automatically removes entries for deleted canvas files
   - Persists across sessions in plugin settings

##### Quick Actions Tab

**Purpose:** Centralized access to primary commands

**Content:**

1. **Tree Operations:**
   ```
   ┌─────────────────────────────────────┐
   │ Tree Operations                     │
   ├─────────────────────────────────────┤
   │ [Generate Tree for Current Note]    │
   │ Root Person: (auto-detect)          │
   │ Target Canvas: [Select...]          │
   │                                     │
   │ [Re-Layout Current Canvas]          │
   │ [Clear Canvas]                      │
   └─────────────────────────────────────┘
   ```

2. **Person Management:**
   ```
   ┌─────────────────────────────────────┐
   │ Person Management                   │
   ├─────────────────────────────────────┤
   │ [Open Person Detail Panel]          │
   │ [Create New Person Note]            │
   │ [Validate All Relationships]        │
   └─────────────────────────────────────┘
   ```

3. **Quick Settings:**
   - Master volume/visibility toggles
   - Quick preset selection
   - Active overlay indicator

##### Canvas Settings Tab

**Purpose:** Adjust canvas layout dimensions and arrow styling for visual customization

**Content:**

1. **Layout Settings Card:**
   ```
   ┌─────────────────────────────────────┐
   │ Layout Settings                     │
   ├─────────────────────────────────────┤
   │ Horizontal Spacing: [400] px        │
   │ Vertical Spacing:   [250] px        │
   │                                     │
   │ Node Width:  [200] px               │
   │ Node Height: [100] px               │
   │                                     │
   │ ℹ Changes apply to new trees        │
   │ Use "Re-layout" for existing canvases│
   └─────────────────────────────────────┘
   ```

2. **Arrow Styling Card:** *(Implemented 2025-11-22)*
   ```
   ┌─────────────────────────────────────┐
   │ Arrow Styling                       │
   ├─────────────────────────────────────┤
   │ Parent → Child Arrows:              │
   │ [Directed (→)            ▼]         │
   │                                     │
   │ Spouse Arrows:                      │
   │ [Undirected (—)          ▼]         │
   │                                     │
   │ Options:                            │
   │ • Directed (→) - Single arrow       │
   │ • Bidirectional (↔) - Both ends     │
   │ • Undirected (—) - No arrows        │
   └─────────────────────────────────────┘
   ```

**Arrow Style Modes:**

| Style | Visual | Use Case |
|-------|--------|----------|
| **Directed** | `→` | Default for parent-child relationships. Arrow points from parent to child, showing generational flow. |
| **Bidirectional** | `↔` | Arrows on both ends. Useful for emphasizing reciprocal relationships or spouse connections. |
| **Undirected** | `—` | Just lines, no arrows. Default for spouse relationships. Creates cleaner look when direction isn't meaningful. |

**JSON Canvas Compliance:**

Arrow styling uses the JSON Canvas 1.0 spec's `fromEnd` and `toEnd` properties:
- `fromEnd`: `'none'` or `'arrow'` (start of edge)
- `toEnd`: `'none'` or `'arrow'` (end of edge)

**Defaults:**
- Parent-child: Directed (`fromEnd: 'none'`, `toEnd: 'arrow'`)
- Spouse: Undirected (`fromEnd: 'none'`, `toEnd: 'none'`)

##### Data Entry Tab

**Purpose:** Streamlined interface for creating new person notes with automatic relationship linking

**Use Cases:**
- Building family trees from scratch
- Quick data entry during research sessions
- Creating test/dummy data during development
- Transcribing from physical documents or records

**Content:**

1. **Person Information Form:**
   ```
   ┌─────────────────────────────────────┐
   │ Create New Person                   │
   ├─────────────────────────────────────┤
   │ Name: [John Robert Smith         ]  │
   │                                     │
   │ ☑ Auto-generate cr_id               │
   │ cr_id: [abc-123-def-456] (read-only)│
   │                                     │
   │ Birth Date: [1888-05-15      ] 📅  │
   │ Death Date: [1952-08-20      ] 📅  │
   │ ☐ Mark as living                    │
   │                                     │
   │ Birth Place: [Boston, MA         ]  │
   │ Death Place: [Seattle, WA        ]  │
   └─────────────────────────────────────┘
   ```

2. **Relationship Linking:**
   ```
   ┌─────────────────────────────────────┐
   │ Relationships                       │
   ├─────────────────────────────────────┤
   │ Father: [Search existing...] [🔍]  │
   │ Mother: [Search existing...] [🔍]  │
   │                                     │
   │ Spouse: [Search existing...] [🔍]  │
   │         [+ Add another spouse]      │
   │                                     │
   │ Note: Relationships are automatically │
   │ synced bidirectionally              │
   └─────────────────────────────────────┘
   ```

3. **File Location:**
   ```
   ┌─────────────────────────────────────┐
   │ Save Location                       │
   ├─────────────────────────────────────┤
   │ File: People/John Robert Smith.md   │
   │ [📁 Change folder...]               │
   └─────────────────────────────────────┘
   ```

4. **Action Buttons:**
   ```
   ┌─────────────────────────────────────┐
   │ [Cancel]                            │
   │ [Create & Open Note]                │
   │ [Create & Add Another]              │
   └─────────────────────────────────────┘
   ```

**Workflow:**

1. **Create & Open Note:**
   - Creates the person note with entered data
   - Opens the note in editor
   - Closes Control Center

2. **Create & Add Another:**
   - Creates the person note with entered data
   - Shows success notification
   - Clears the form for next entry
   - Keeps Control Center open
   - Pre-increments dates for sequential entry (e.g., siblings)

**Features:**

- **Person Search:** Type-ahead search with fuzzy matching
  - Shows existing persons with same/similar names
  - Displays birth/death dates for disambiguation
  - Click to select and link

- **Duplicate Detection:**
  - Warns if similar person exists (name + birth date)
  - Shows potential matches
  - Option to proceed or cancel

- **Validation:**
  - Required: Name, cr_id (auto-generated if enabled)
  - Optional: All other fields
  - Date format validation
  - Circular relationship detection

- **Auto-generation:**
  - cr_id: UUID v4 format
  - File name: Sanitized from person name
  - Folder: User-configurable default location

**Success Notification:**

```
✓ Person created successfully!

[[John Robert Smith]] has been created.

[View on Canvas]  [Open Note]  [Open in Detail Panel]
```

**MVP Implementation:**
- Simple form with all fields visible
- Auto-generate cr_id (mandatory)
- Basic person search for relationships
- "Create & Open" and "Create & Add Another" buttons
- File location configuration
- Duplicate name warning

**Phase 2 Enhancements:**
- Context-aware creation modes:
  - "Create child of [Person]"
  - "Create spouse of [Person]"
  - "Create sibling of [Person]"
- Inline creation of related persons
- Template support (Standard, Detailed, Minimal)
- Batch entry mode for siblings

**Phase 3+ Enhancements:**
- Import from clipboard/CSV
- Research mode (mark fields as uncertain)
- Source citation fields
- Extended properties (medical, location, etc.)

**Command Integration:**

```typescript
// Opens Control Center to Data Entry tab
this.addCommand({
  id: 'create-new-person',
  name: 'Create New Person',
  callback: () => {
    const modal = new ControlCenterModal(this.app, this);
    modal.openToTab('data-entry');
  }
});
```

##### Tree Generation Tab

**Purpose:** Select root person, configure tree settings, and generate family trees

**Layout:** Single streamlined card containing person selection, configuration, and generation actions

**Content Sections:**

1. **Root Person Card:**

   This integrated card combines person selection, tree configuration, and generation actions in a single, scrollable interface.

   **Part A: Person Selection Display**
   ```
   ┌─────────────────────────────────────┐
   │ Root Person                         │
   ├─────────────────────────────────────┤
   │ Empty State (no selection):         │
   │   👤 No person selected             │
   │   Select a person below to start    │
   │                                     │
   │ OR Selected State:                  │
   │   John Robert Smith                 │
   │   ID: abc-123-def-456               │
   │   1888-1952                         │
   └─────────────────────────────────────┘
   ```

   **Part B: Inline Person Browser**

   The person browser is embedded directly in the card, eliminating the need for modal dialogs:

   ```
   ┌─────────────────────────────────────┐
   │ Search: [____________]  [🔍]        │
   ├─────────────────────────────────────┤
   │ Sort by: [Name (A-Z) ▼]             │
   │ Living:  [All ▼]                    │
   │ Birth:   [All ▼]                    │
   │ Sex:     [All ▼]                    │
   ├─────────────────────────────────────┤
   │ ┌────────┬─────────────────────┐    │
   │ │ All (5)│ John Smith          │    │  ← Scrollable
   │ │ ─────  │ b. 1920 - d. 2005   │    │     results
   │ │ Fam 1  │ ID: abc-123         │    │     (400px max)
   │ │ (3)    │                     │    │
   │ │        │ Mary Jones          │    │
   │ │ Fam 2  │ b. 1925             │    │
   │ │ (2)    │ ID: def-456         │    │
   │ └────────┴─────────────────────┘    │
   └─────────────────────────────────────┘
   ```

   **Features:**
   - **Search:** Real-time filtering by person name
   - **Sort Options:**
     - Name (A-Z)
     - Name (Z-A)
     - Birth year (oldest first)
     - Birth year (youngest first)
     - Recently modified
   - **Filters:**
     - Living status: All / Living only / Deceased only
     - Birth date: All / Has date / No date
     - Sex: All / Male / Female
   - **Family Sidebar:** When multiple disconnected family groups exist, shows tabs for each group with person counts
   - **Constrained Height:** Results scroll within 400px max-height container

   **Part C: Tree Generation Actions**
   ```
   ┌─────────────────────────────────────┐
   │ Canvas name (optional):             │
   │ [Family Tree - Smith Family      ]  │
   │                                     │
   │ [Generate family tree            ]  │ ← Large primary button
   │                                     │
   │ ─────────────── OR ──────────────   │
   │                                     │
   │ Automatically generate one tree for │
   │ each disconnected family group.     │
   │ Found 6 disconnected family groups. │
   │                                     │
   │ [Generate all trees              ]  │ ← Large secondary button
   └─────────────────────────────────────┘
   ```

   **"Generate All Trees" Behavior:**
   - Automatically detects all disconnected family components using BFS graph traversal
   - Selects one representative person from each component
   - Generates separate canvas files for each family group
   - Dynamic message updates with actual family group count
   - No manual multi-selection required

2. **Tree Configuration Card:**
   ```
   ┌─────────────────────────────────────┐
   │ Tree Configuration                  │
   ├─────────────────────────────────────┤
   │ Tree type: [Full family tree ▼]    │
   │   • Ancestors only                  │
   │   • Descendants only                │
   │   • Full family tree                │
   │                                     │
   │ Generations: [All ▼]                │
   │   • All                             │
   │   • 1-10 generations                │
   │                                     │
   │ ☑ Include spouses                   │
   └─────────────────────────────────────┘
   ```

3. **Layout Options Card:**
   ```
   ┌─────────────────────────────────────┐
   │ Layout Options                      │
   ├─────────────────────────────────────┤
   │ Direction: [Vertical ▼]             │
   │   • Vertical (ancestors up)         │
   │   • Horizontal (ancestors left)     │
   │                                     │
   │ Spacing:                            │
   │   Horizontal: [300] px              │
   │   Vertical:   [200] px              │
   └─────────────────────────────────────┘
   ```

5. **Canvas Color Customization:** *(Future Enhancement)*
   ```
   ┌─────────────────────────────────────┐
   │ Canvas Colors                       │
   ├─────────────────────────────────────┤
   │ Node Colors:                        │
   │   Male:    [Color 4 - Green ▼]     │
   │   Female:  [Color 6 - Purple ▼]    │
   │   Unknown: [Color 2 - Orange ▼]    │
   │                                     │
   │ Edge Colors:                        │
   │   Parent-Child: [Color 1 - Red ▼]  │
   │   Spouse:       [Color 5 - Blue ▼] │
   │                                     │
   │ Available Colors:                   │
   │   1=Red, 2=Orange, 3=Yellow,        │
   │   4=Green, 5=Blue, 6=Purple         │
   │                                     │
   │ ☐ Color nodes by gender             │
   │                                     │
   │ [Reset to Defaults]                 │
   └─────────────────────────────────────┘
   ```

   **Current Implementation (v1.8):**
   - Gender-based coloring using sex/gender field from frontmatter
   - Male persons: Canvas color 4 (Green)
   - Female persons: Canvas color 6 (Purple)
   - Unknown gender: Canvas color 2 (Orange)
   - Parent-child edges: Canvas color 1 (Red)
   - Spouse edges: Canvas color 5 (Blue)
   - Automatically reads `sex` or `gender` field from YAML frontmatter
   - Standard GEDCOM values supported: M, F, U (male, female, unknown)

##### Properties Tab (Phase 2)

**Purpose:** Configure custom property names for person note YAML frontmatter

**Rationale:**
- **Migration:** Adapt to existing vaults with different property naming conventions
- **Localization:** Support non-English genealogy workflows
- **Flexibility:** Allow users to choose their own naming preferences
- **Compatibility:** Enable custom namespacing or integration with other systems

**Default Property Names (GEDCOM-Compatible):**

The plugin ships with GEDCOM-compatible property names:

```yaml
# Standard genealogy properties (no prefix)
name: "John Robert Smith"
father: "cr-id-123"      # or "[[Father Name]]" for legacy
mother: "cr-id-456"      # or "[[Mother Name]]" for legacy
spouse: "cr-id-789"      # or ["cr-id-789", "cr-id-012"] for multiple
children: ["cr-id-345", "cr-id-678"]
born: "1888-05-15"
died: "1952-08-20"

# Canvas Roots-specific properties (cr_ prefix)
cr_id: "abc-123-def-456"
cr_living: true
cr_root: true
cr_ref_num: "12.3"
```

**Content Sections:**

1. **Standard Properties:**
   ```
   ┌─────────────────────────────────────┐
   │ Standard Genealogy Properties       │
   ├─────────────────────────────────────┤
   │ Name:     [name              ]      │
   │ Father:   [father            ]      │
   │ Mother:   [mother            ]      │
   │ Spouse:   [spouse            ]      │
   │ Children: [children          ]      │
   │ Born:     [born              ]      │
   │ Died:     [died              ]      │
   │                                     │
   │ [Reset to GEDCOM Defaults]          │
   └─────────────────────────────────────┘
   ```

2. **Canvas Roots Properties:**
   ```
   ┌─────────────────────────────────────┐
   │ Canvas Roots-Specific Properties    │
   ├─────────────────────────────────────┤
   │ Unique ID:       [cr_id       ]     │
   │ Living Status:   [cr_living   ]     │
   │ Root Marker:     [cr_root     ]     │
   │ Reference Num:   [cr_ref_num  ]     │
   │                                     │
   │ [Reset to Plugin Defaults]          │
   └─────────────────────────────────────┘
   ```

3. **Migration Tools:**
   ```
   ┌─────────────────────────────────────┐
   │ Migrate Existing Notes              │
   ├─────────────────────────────────────┤
   │ From: [father_cr_id  ] To: [father] │
   │                                     │
   │ ☑ Backup notes before migration     │
   │ ☑ Dry run (preview changes)         │
   │                                     │
   │ Scope:                              │
   │   ● Entire vault                    │
   │   ○ Current folder and subfolders   │
   │   ○ Selected notes only             │
   │                                     │
   │ [Preview Changes]  [Start Migration]│
   └─────────────────────────────────────┘
   ```

4. **Validation and Warnings:**
   ```
   ┌─────────────────────────────────────┐
   │ Property Name Validation            │
   ├─────────────────────────────────────┤
   │ ⚠ Warning: Changing property names  │
   │   will not update existing notes.   │
   │   Use Migration Tools below.        │
   │                                     │
   │ ✓ Valid YAML property names         │
   │ ✗ No duplicates detected            │
   │ ✓ No conflicts with Dataview        │
   └─────────────────────────────────────┘
   ```

**Features:**

- **Live Validation:**
  - Check for valid YAML property names (no spaces, special chars)
  - Detect duplicate property names
  - Warn about conflicts with common Dataview properties
  - Preview impact on existing notes

- **Migration Support:**
  - Bulk rename properties across existing notes
  - Dry-run mode to preview changes
  - Automatic backup creation before migration
  - Scope control (vault-wide, folder, selection)
  - Bidirectional migration (old ↔ new names)

- **Preset Configurations:**
  - GEDCOM Standard (default)
  - Gramps Style (`birth_date`, `death_date`)
  - Legacy Canvas Roots (`cr_father`, `cr_mother`)
  - Custom user presets

**Implementation Notes:**

```typescript
export interface PropertyNameConfig {
  // Standard properties
  name: string;          // default: "name"
  father: string;        // default: "father"
  mother: string;        // default: "mother"
  spouse: string;        // default: "spouse"
  children: string;      // default: "children"
  born: string;          // default: "born"
  died: string;          // default: "died"

  // Canvas Roots properties
  crId: string;          // default: "cr_id"
  crLiving: string;      // default: "cr_living"
  crRoot: string;        // default: "cr_root"
  crRefNum: string;      // default: "cr_ref_num"
}

// Plugin settings
export interface CanvasRootsSettings {
  propertyNames: PropertyNameConfig;
  // ... other settings
}
```

**Use Cases:**

1. **Existing Vault Migration:**
   - User has existing notes with custom property names
   - Configure Properties tab to match existing convention
   - Or use migration tool to standardize to Canvas Roots defaults (`born`, `died`)

2. **Localization:**
   - German user prefers `geboren` (born), `gestorben` (died)
   - Configure property names to match language preference
   - Maintain GEDCOM compatibility via export mapping

3. **Multi-System Integration:**
   - User imports from Gramps (uses `birth_date`, `death_date`)
   - Configure Canvas Roots to read Gramps property names
   - Export to GEDCOM using standard mapping

4. **Custom Namespacing:**
   - User has multiple genealogy systems in same vault
   - Add custom prefix: `canvasroots_father`, `canvasroots_mother`
   - Avoid conflicts with other property sets

**MVP Implementation:**
- Property name configuration UI
- Live validation
- Reset to defaults buttons
- Settings persistence

**Phase 2 Enhancements:**
- Migration tools (dry run, backup, bulk rename)
- Preset configurations
- Import/export property mappings

**Phase 3+ Enhancements:**
- GEDCOM property mapping editor
- Multi-language property presets
- Advanced validation (Dataview compatibility checks)
- Property aliasing (read from multiple names)

##### GEDCOM Tab

**Purpose:** Import, export, and merge genealogical data

**Content Sections:**

1. **Import GEDCOM:**
   ```
   ┌─────────────────────────────────────┐
   │ Import GEDCOM File                  │
   ├─────────────────────────────────────┤
   │ Creates person notes for all        │
   │ individuals in the GEDCOM file      │
   │                                     │
   │ UUID Handling:                      │
   │   ☑ Preserve _UUID tags             │
   │   ☑ Detect duplicates               │
   │                                     │
   │ [Select GEDCOM File...]             │
   │ [Start Import]                      │
   └─────────────────────────────────────┘
   ```

2. **Export GEDCOM:**
   ```
   ┌─────────────────────────────────────┐
   │ Export to GEDCOM                    │
   ├─────────────────────────────────────┤
   │ Obfuscation Level:                  │
   │   ○ None (full data)                │
   │   ○ Minimal (year only)             │
   │   ● Standard (names + dates)        │
   │   ○ Full (maximum privacy)          │
   │                                     │
   │ Apply to:                           │
   │   ● All individuals                 │
   │   ○ Living individuals only         │
   │   ○ Minors only                     │
   │                                     │
   │ ☑ Generate mapping file             │
   │ ☑ Preserve UUIDs                    │
   │                                     │
   │ [Export GEDCOM...]                  │
   └─────────────────────────────────────┘
   ```

3. **Merge Collections:**
   ```
   ┌─────────────────────────────────────┐
   │ Merge External Collection           │
   ├─────────────────────────────────────┤
   │ Source: [Browse vault/folder...]    │
   │                                     │
   │ Strategy:                           │
   │   ● UUID-based (recommended)        │
   │   ○ Manual selection only           │
   │                                     │
   │ Conflict Resolution:                │
   │   ● Prompt for each conflict        │
   │   ○ Always keep target data         │
   │   ○ Always prefer source data       │
   │                                     │
   │ [Start Merge]                       │
   └─────────────────────────────────────┘
   ```

##### Person Detail Tab (Phase 4+)

**Purpose:** Configure Person Detail Panel and quick person access

**Content:**

1. **Panel Settings:**
   - Location (left/right sidebar)
   - Auto-open behavior
   - Field display order
   - Enabled fields

2. **Quick Person Lookup:**
   - Search and open any person
   - Recent persons list
   - Bookmarked persons

##### Advanced Tab (Phase 4+)

**Purpose:** Access to advanced features and experimental settings

**Content Sections:**

1. **Reference Numbering (Phase 2+):**
   - System selection (Dollarhide-Cole, Ahnentafel, Custom)
   - Root person configuration
   - Calculate/recalculate commands

2. **Obfuscation Settings (Phase 3+):**
   - Canvas obfuscation toggle
   - Living individuals filter
   - Minor protection settings

3. **Relationship Quality (Phase 5+):**
   - Visualization toggles
   - Color scheme configuration

4. **Medical Genogram (Phase 5+):**
   - Medical symbol display
   - Privacy controls

5. **World-Building Features (Phase 6+):**
   - Organizational evolution
   - Succession rules engine
   - Dual relationship trees

#### 3.6.5 Material Design Components

**Reusable UI Components:**

The Control Center uses a set of reusable Material Design components adapted from Sonigraph:

**Component Files:**

```
src/ui/
  ├── control-center.ts          ← Main modal class
  ├── material-components.ts     ← Reusable components
  ├── lucide-icons.ts            ← Icon management
  └── control-center.css         ← Material Design styling
```

**Component Library:**

| Component | Purpose | Example Usage |
|-----------|---------|---------------|
| `MaterialCard` | Content containers with headers | Wrap stat displays, forms |
| `MaterialButton` | Consistent button styling | Actions, navigation |
| `MaterialSlider` | Numeric input with visual feedback | Spacing, dimensions, volume |
| `ActionChip` | Toggle buttons and filters | Enable/disable options |
| `StatCard` | Display key metrics | Vault statistics |
| `EffectSection` | Collapsible settings groups | Group related settings |

**Example Component Usage:**

```typescript
// Create a stat card
const statCard = new StatCard({
  value: '247',
  label: 'Total People',
  iconName: 'users',
  color: 'primary'
});

// Create a material card with content
const settingsCard = new MaterialCard({
  title: 'Layout Configuration',
  iconName: 'layout',
  elevation: 2
});

// Add slider for node width
const widthSlider = new MaterialSlider({
  value: this.plugin.settings.defaultNodeWidth,
  min: 100,
  max: 400,
  step: 10,
  unit: 'px',
  onChange: (value) => {
    this.plugin.settings.defaultNodeWidth = value;
    await this.plugin.saveSettings();
  }
});

settingsCard.addContent(widthSlider.getElement());
```

#### 3.6.6 Styling System

**CSS Architecture:**

Based on Material Design 3 principles, using Obsidian's native color system:

**Design Tokens:**

```css
:root {
  /* Surface colors */
  --crc-surface: var(--background-secondary);
  --crc-surface-variant: var(--background-modifier-border-hover);

  /* Primary colors */
  --crc-primary: var(--interactive-accent);
  --crc-primary-container: var(--interactive-accent-hover);

  /* Text colors */
  --crc-on-surface: var(--text-normal);
  --crc-on-surface-variant: var(--text-muted);

  /* Elevation system */
  --crc-elevation-1: 0 1px 3px rgba(0, 0, 0, 0.12);
  --crc-elevation-2: 0 3px 6px rgba(0, 0, 0, 0.16);

  /* Spacing (4dp base unit) */
  --crc-space-2: 8px;
  --crc-space-4: 16px;
  --crc-space-6: 24px;

  /* Corner radius */
  --crc-corner-sm: 8px;
  --crc-corner-md: 12px;

  /* Motion */
  --crc-motion-standard: cubic-bezier(0.4, 0.0, 0.2, 1);
  --crc-duration-medium: 300ms;
}
```

**Class Naming Convention:**

- Prefix: `crc-` (Canvas Roots Control)
- BEM methodology: `crc-block__element--modifier`
- Examples:
  - `.crc-modal-container`
  - `.crc-drawer__item--active`
  - `.crc-card__header`

#### 3.6.7 State Management

**Modal State:**

```typescript
interface ControlCenterState {
  activeTab: string;
  lastOpenedPerson?: string;
  quickSettings: {
    rootPerson?: string;
    targetCanvas?: string;
    activeOverlay?: string;
  };
}
```

**State Persistence:**

- Active tab remembered across sessions
- Quick settings cached per session
- Form values preserved during modal lifecycle

#### 3.6.8 Integration Points

**Plugin Integration:**

```typescript
// In main.ts
this.addCommand({
  id: 'open-control-center',
  name: 'Open Control Center',
  callback: () => {
    new ControlCenterModal(this.app, this).open();
  }
});

// Optional ribbon icon
this.addRibbonIcon(
  'git-branch',
  'Canvas Roots Control Center',
  () => {
    new ControlCenterModal(this.app, this).open();
  }
);
```

**Context Menu Integration:**

```typescript
// Right-click on canvas nodes
this.registerEvent(
  this.app.workspace.on('canvas:node-menu', (menu, node) => {
    if (this.isPersonNode(node)) {
      menu.addItem((item) => {
        item
          .setTitle('View in Control Center')
          .setIcon('git-branch')
          .onClick(() => {
            const modal = new ControlCenterModal(this.app, this);
            modal.openToPersonTab(node.file.path);
          });
      });
    }
  })
);
```

#### 3.6.9 Implementation Priority

**MVP (Phase 1):**
- Modal structure with navigation drawer
- Status tab (basic stats)
- Quick Actions tab (Generate Tree, Re-Layout)
- Material components library (Card, Button, Slider)
- Basic CSS styling

**Phase 2:**
- Tree Generation tab with all settings
- Layout preview functionality
- Filter controls
- Properties tab (configurable property names)

**Phase 3:**
- GEDCOM tab (import/export)
- Merge collections interface

**Phase 4:**
- Person Detail tab integration
- Advanced settings organization

**Phase 5+:**
- Advanced features as they're implemented
- Progressive enhancement of existing tabs

#### 3.6.10 Accessibility

**Keyboard Navigation:**
- Tab key navigation through all interactive elements
- Arrow keys for drawer navigation
- Enter/Space to activate buttons
- Escape to close modal

**Screen Reader Support:**
- ARIA labels on all icons and actions
- Semantic HTML structure
- Focus management
- Status announcements for async operations

**Visual Accessibility:**
- High contrast mode support via Obsidian theme
- Minimum touch target size: 44x44px
- Clear focus indicators
- Readable font sizes (minimum 12px)

### 3.5 Layout Algorithm

**Requirements:**
- Support multi-parent graphs (not simple trees)
- Handle complex relationships: siblings, multiple spouses, adoptive parents
- Produce non-overlapping layouts
- Similar to algorithms in family-chart library

**Coordinate System:**
- Calculate absolute positions via D3
- Apply viewport offset to center tree in current view
- Maintain consistent spacing between generations

---

## 4. Technical Implementation

### 4.1 Dependencies

| Dependency | Purpose | Version |
|------------|---------|---------|
| Obsidian API | Core plugin functionality | Latest |
| D3.js | Layout calculation | 7.x+ |
| TypeScript | Development language | 5.x+ |

### 4.2 Obsidian API Usage

**Required APIs:**
- `app.vault.read()` - Read Canvas JSON and note files
- `app.vault.write()` - Write Canvas JSON
- `app.vault.getAbstractFileByPath()` - Locate person notes
- `Notice` - User feedback/notifications
- `Plugin` - Core plugin class
- `Command` - Register commands

### 4.3 Canvas JSON Structure

The plugin reads and writes Obsidian's Canvas file format (`.canvas`):

```json
{
  "nodes": [
    {
      "id": "node-uuid-1",
      "x": 0,
      "y": 0,
      "width": 200,
      "height": 100,
      "type": "file",
      "file": "People/John Smith.md",
      "color": "6"
    },
    {
      "id": "node-uuid-2",
      "x": 50,
      "y": 150,
      "width": 50,
      "height": 30,
      "type": "text",
      "text": "&"
    }
  ],
  "edges": [
    {
      "id": "edge-uuid-3",
      "fromNode": "node-uuid-1",
      "fromSide": "bottom",
      "toNode": "node-uuid-4",
      "toSide": "top"
    }
  ]
}
```

**Node Types:**
- **File nodes:** Person cards (link to `.md` files)
- **Text nodes:** Marriage indicators (optional for MVP)

**Edge Properties:**
- Connect parent to child nodes
- Connect spouse nodes
- Side indicators control connection points

### 4.4 Canvas CSS Variables and Theming

**Overview:** Obsidian Canvas provides CSS variables for customizing canvas appearance. Canvas Roots leverages these for consistent visual styling.

**Available Canvas CSS Variables:**

| Variable | Description | Default Usage |
|----------|-------------|---------------|
| `--canvas-background` | Canvas background color | Inherited from theme |
| `--canvas-card-label-color` | Canvas card label text color | Inherited from theme |
| `--canvas-dot-pattern` | Canvas dot pattern color | Inherited from theme |
| `--canvas-color-1` | Card/edge color 1 (Red) | Parent-child edges |
| `--canvas-color-2` | Card/edge color 2 (Orange) | Unknown gender nodes |
| `--canvas-color-3` | Card/edge color 3 (Yellow) | Unused (available) |
| `--canvas-color-4` | Card/edge color 4 (Green) | Male nodes |
| `--canvas-color-5` | Card/edge color 5 (Blue) | Spouse edges |
| `--canvas-color-6` | Card/edge color 6 (Purple) | Female nodes |

**Canvas Roots Color Usage (v1.8):**

```typescript
// Node colors (based on sex/gender field)
getPersonColor(person: PersonNode): string {
  if (person.sex === 'M' || person.sex === 'MALE') return '4'; // Green
  if (person.sex === 'F' || person.sex === 'FEMALE') return '6'; // Purple
  return '2'; // Orange (unknown/neutral)
}

// Edge colors (based on relationship type)
getEdgeColor(type: RelationType): string {
  if (type === 'parent' || type === 'child') return '1'; // Red
  if (type === 'spouse') return '5'; // Blue
  return '3'; // Yellow (default)
}
```

**Future Enhancement - Custom Theme Support:**

Canvas Roots could provide custom CSS snippets to override canvas colors specifically for family trees:

```css
/* Custom Canvas Roots theme */
.canvas-node[data-canvas-roots="true"] {
  /* Override canvas colors for family trees */
  --canvas-color-4: #4a9eff; /* Custom male color */
  --canvas-color-6: #ff4a9e; /* Custom female color */
}
```

**Benefits:**
- Consistent with Obsidian's native Canvas styling
- Users can customize colors via CSS snippets
- Theme-aware (respects light/dark mode)
- No custom rendering required

### 4.5 ID Mapping and Persistence

**Challenge:** Maintain stable identity across Canvas re-layouts

**Solution:**
1. **Stable ID:** Use `cr_id` from person note as primary key
2. **Transient ID:** Canvas `node.id` can change between layouts
3. **File Path Matching:** Match Canvas nodes to notes via `file` property
4. **Update Strategy:** Modify existing node positions, don't duplicate

**Coordinate Offset:**
- Calculate relative D3 positions
- Add offset based on current Canvas viewport center
- Ensure tree appears in visible area

---

## 5. GEDCOM Integration

### 5.1 Overview

GEDCOM (Genealogical Data Communication) is the industry standard format for family tree data exchange. Canvas Roots supports import and export.

### 5.2 Import Modes

#### Mode 1: Canvas Visualization (Quick Import)

**Purpose:** Rapid visualization without vault modification

**Process:**
1. Parse `.ged` file
2. Extract relationship data
3. Generate Canvas JSON directly
4. **Do not** create Markdown notes in vault

**Use Case:** Preview external family trees without cluttering vault

#### Mode 2: Vault Deep-Sync (Full Integration)

**Purpose:** Complete genealogical data integration

**Process:**
1. Parse `.ged` file completely
2. Create Markdown note for every:
   - Individual (person)
   - Place
   - Source
3. Populate YAML frontmatter with all GEDCOM fields
4. Establish bidirectional [[Link]] connections
5. Handle multimedia references and extended notes

**Use Case:** Migrate genealogical research into Obsidian vault

### 5.3 Export (Round-Trip)

**Command:** `Canvas Roots: Export to GEDCOM`

**Process:**
1. Find all notes containing `cr_id`
2. Extract person data from frontmatter
3. Generate valid `.ged` file
4. Preserve GEDCOM-specific fields for round-trip compatibility

**Purpose:** Allow users to export edited data back to dedicated genealogy software

### 5.4 Data Compatibility and Analysis

**Property Population:**
- All parsed GEDCOM fields stored in frontmatter/Properties
- Maximum compatibility with Dataview and Obsidian Bases
- Enable complex queries and analysis

**Analysis Queries:**

The plugin should provide utility functions and pre-built DataViewJS templates to enable rich data analysis:

**Example Query Templates:**
- "List all living descendants" - Find all people without `died` dates descended from a specific person
- "Table of individuals by age at death" - Calculate and sort lifespans
- "Source-linked individuals" - Show all people connected to specific historical sources
- "Geographic distribution" - Map individuals by birth/death locations
- "Sibling chain visualization" - Display extended sibling relationships and spouses of siblings

**Implementation:**
- Expose helper functions for common genealogical queries
- Provide template library accessible via command palette
- Support complex multi-table queries via Dataview integration
- Enable export of query results to Canvas or tables

### 5.5 Multi-Vault Merging and UUID-Based Data Portability

**Requirement:** Enable seamless merging of multiple genealogical collections using UUID-based identity management, preventing data conflicts and facilitating collaborative research.

#### 5.5.1 UUID as Universal Identity

**Core Principle:** The `cr_id` field serves as the **single source of truth** for person identity across all vaults, GEDCOM exports, and Canvas representations.

**UUID Properties:**

```yaml
cr_id: "abc-123-def-456"  # UUID v4 format recommended
```

**Requirements:**

| Property | Value | Rationale |
|----------|-------|-----------|
| **Format** | UUID v4 (random) | Globally unique, no coordination needed |
| **Immutability** | Never changes once assigned | Stable identity across renames/moves |
| **Auto-generation** | Created on note creation | Prevents manual ID conflicts |
| **GEDCOM mapping** | Maps to `@INDI:xxxxx@` | Round-trip preservation |
| **Persistence** | Preserved across all operations | Export, import, merge, obfuscation |

**Why UUIDs Solve Merging Problems:**

**Without UUIDs:**
- File name collision: Two vaults both have "John Smith.md"
- Cannot determine if same person or different people
- Manual conflict resolution required for every duplicate name
- Risk of data loss or incorrect merges

**With UUIDs:**
- Same `cr_id` = definitively the same person → auto-merge
- Different `cr_id` = definitively different people → keep both
- Name similarity check only for suggesting potential duplicates
- Safe, deterministic merging

#### 5.5.2 Merge Command

**Command:** `Canvas Roots: Merge External Collection`

**Workflow:**

```
┌─────────────────────────────────────────┐
│ Merge External Collection               │
├─────────────────────────────────────────┤
│ Source:  [📁 Browse Vault/Folder...]   │
│                                         │
│ Merge Strategy:                         │
│ ● UUID-based (recommended)              │
│ ○ Manual selection only                 │
│                                         │
│ Conflict Resolution:                    │
│ ● Prompt for each conflict              │
│ ○ Always keep target vault data         │
│ ○ Always prefer source data             │
│ ○ Merge all fields (combine arrays)    │
│                                         │
│ Duplicate Detection:                    │
│ ☑ Suggest potential duplicates          │
│   (same name + similar dates)           │
│                                         │
│ [Cancel]              [Start Merge]    │
└─────────────────────────────────────────┘
```

**Process:**

1. **Scan source collection** for all notes with `cr_id` fields
2. **Compare with target vault** based on `cr_id` matching
3. **Categorize individuals:**
   - **Exact match:** Same `cr_id` in both vaults
   - **New person:** `cr_id` only exists in source
   - **Potential duplicate:** Different `cr_id` but similar name/dates

#### 5.5.3 Merge Resolution Strategies

**Exact Match (Same `cr_id`):**

When the same `cr_id` exists in both vaults, merge field-by-field:

```yaml
# Target vault (existing)
---
cr_id: abc-123-def-456
name: John Robert Smith
born: 1888-05-15
father: "[[John Smith Sr]]"
spouse: ["[[Mary Jones]]"]
---

# Source vault (being merged)
---
cr_id: abc-123-def-456
name: John R. Smith
died: 1952-08-20
mother: "[[Jane Doe]]"
spouse: ["[[Mary Jones]]", "[[Sarah Brown]]"]
notes: "Veteran of WWI"
---

# Merged result
---
cr_id: abc-123-def-456
name: John Robert Smith  # Keep target (or prompt user)
born: 1888-05-15
died: 1952-08-20         # Add from source
father: "[[John Smith Sr]]"
mother: "[[Jane Doe]]"   # Add from source
spouse: ["[[Mary Jones]]", "[[Sarah Brown]]"]  # Merge arrays
notes: "Veteran of WWI"  # Add from source
---
```

**Merge Rules:**

| Field Conflict | Default Behavior | User Override |
|----------------|------------------|---------------|
| **Both have value** | Prompt user to choose | Always target/source/merge |
| **One has value** | Use the available value | N/A |
| **Arrays** | Union of both arrays | Keep target only |
| **Dates** | Keep most precise format | Choose manually |
| **Note body** | Append source to target with separator | Overwrite/skip |

**New Person (Source only):**

Simply import the note with all data intact:

```yaml
---
cr_id: xyz-789-new-123
name: Maria Romano
born: 1905-03-12
# ... rest of data
---
```

**Potential Duplicate Detection:**

When different `cr_id` values have suspiciously similar data:

```
┌─────────────────────────────────────────┐
│ ⚠️ Potential Duplicate Detected         │
├─────────────────────────────────────────┤
│ Target Vault:                           │
│ cr_id: aaa-111-bbb-222                  │
│ Name: John Smith                        │
│ Born: 1888-05-15                        │
│ Died: 1952-08-20                        │
│                                         │
│ Source Vault:                           │
│ cr_id: ccc-333-ddd-444                  │
│ Name: John Smith                        │
│ Born: 1888-05-14  (1 day difference!)  │
│ Died: 1952-08                           │
│                                         │
│ Are these the same person?              │
│ [Yes - Merge] [No - Keep Both] [Skip]  │
│                                         │
│ If merged, which cr_id should be kept?  │
│ ○ aaa-111-bbb-222 (target)              │
│ ○ ccc-333-ddd-444 (source)              │
└─────────────────────────────────────────┘
```

**Similarity Detection Criteria:**

- **Name:** Exact match or close Levenshtein distance
- **Dates:** Birth/death within reasonable threshold (e.g., 5 years)
- **Parents:** Same parent names (even if different `cr_id`)
- **Location:** Same birth/death places

#### 5.5.4 GEDCOM UUID Preservation

**Export Mapping:**

```gedcom
0 @I001@ INDI
1 _UUID abc-123-def-456
1 NAME John Robert /Smith/
1 BIRT
2 DATE 15 MAY 1888
```

**Round-Trip Guarantee:**

1. **Obsidian → GEDCOM:** `cr_id` stored in `_UUID` tag
2. **GEDCOM → Obsidian:** `_UUID` tag restored to `cr_id` field
3. **Merge after round-trip:** Same person recognized by preserved UUID

**Benefits:**

- Export to Family Tree Maker, keep `cr_id` in custom tag
- Re-import after external edits, preserve identity
- Merge external GEDCOM files that originated from Canvas Roots

#### 5.5.5 Collaborative Research Workflow

**Use Case:** Multiple researchers working on same family tree

**Scenario:**
- Researcher A has paternal line (500 people)
- Researcher B has maternal line (400 people)
- 50 people appear in both collections (shared ancestors)

**Workflow:**

1. **Initial Setup:**
   - Each researcher maintains separate vault
   - Each assigns unique `cr_id` to all individuals

2. **Export/Share:**
   - Researcher A exports to GEDCOM with UUID preservation
   - Sends to Researcher B

3. **Merge:**
   - Researcher B runs `Merge External Collection`
   - Plugin detects 50 shared ancestors via duplicate detection
   - User confirms which individuals are same person
   - Plugin merges data, updates `cr_id` references

4. **Synchronization:**
   - Future merges recognize same `cr_id` values
   - Only new/changed data prompts for review

#### 5.5.6 Merge Conflict Log

After merge completes, generate a detailed log:

```markdown
# Merge Log - 2025-11-18 15:30:00

**Source:** /path/to/external/vault
**Target:** Current vault

## Summary

- **New individuals added:** 320
- **Exact matches merged:** 45
- **Potential duplicates reviewed:** 12
  - Merged as same person: 8
  - Kept as separate: 4
- **Conflicts resolved:** 23

## Detailed Changes

### Exact Matches (cr_id matched)

#### John Robert Smith (abc-123-def-456)
- Added `died` date: 1952-08-20
- Added `mother` link: [[Jane Doe]]
- Merged `spouse` array: Added [[Sarah Brown]]
- Appended research notes (42 lines)

### New Individuals

- Maria Romano (xyz-789-new-123)
- Giuseppe Romano (xyz-790-new-456)
[... 318 more ...]

### Duplicates Merged

#### John Smith Jr.
- Target cr_id: aaa-111-bbb-222 ← **kept**
- Source cr_id: ccc-333-ddd-444 ← replaced
- Reason: Same name, birth date within 1 day
- All references to ccc-333-ddd-444 updated to aaa-111-bbb-222

### Conflicts Resolved

[Detailed list of field-level conflicts and resolutions...]
```

#### 5.5.7 Settings

**Merge Configuration:**

```yaml
merge_settings:
  uuid_preservation: true          # Always preserve cr_id
  duplicate_detection_threshold:
    name_similarity: 0.9           # Levenshtein ratio
    date_difference_years: 5       # Birth/death tolerance
    require_parent_match: false    # Strict parent matching

  default_conflict_resolution:
    mode: prompt                   # prompt, target, source, merge
    array_merge_strategy: union    # union, target_only, source_only
    note_append_separator: "\n\n---\n\nMerged from external collection:\n\n"

  post_merge:
    generate_log: true
    backup_before_merge: true
    validate_relationships: true   # Check for broken links
```

#### 5.5.8 Use Cases

**Multi-Vault Research:**
- Maintain separate vaults for different family branches
- Periodically merge to create master tree
- Export combined tree for publication

**Collaborative Genealogy:**
- Multiple family members research independently
- Share GEDCOM exports with UUID preservation
- Merge contributions without data loss

**External Data Integration:**
- Import GEDCOM from Ancestry.com (assign UUIDs on import)
- Add research in Obsidian
- Re-import updated Ancestry data later
- Merge recognizes same individuals via UUID

**Disaster Recovery:**
- Vault corruption or accidental deletion
- Restore from GEDCOM backup
- Merge with current vault to recover lost data
- UUIDs prevent duplicate creation

**Migration from Other Tools:**
- Export from Family Tree Maker
- Import to Canvas Roots (assign UUIDs)
- Continue research in Obsidian
- Later merge with data from GenoPro (also UUID-tagged)

---

### 5.6 Privacy and Data Obfuscation

**Requirement:** Protect personally identifiable information (PII) when sharing family trees publicly or for demonstrations.

#### 5.6.1 Obfuscation Modes

The plugin must support optional obfuscation during export and canvas rendering:

**Export Obfuscation:**
- Applied during GEDCOM export via export dialog option
- Original vault data remains completely intact
- Generate obfuscated `.ged` file for sharing

**Canvas Obfuscation:**
- Temporary display mode for screenshots/presentations
- Toggle via command: `Canvas Roots: Toggle Obfuscation Mode`
- Visual indicator when obfuscation is active
- Does not modify underlying notes

#### 5.6.2 Obfuscation Levels

| Level | Names | Dates | Locations | Notes/Research | Media |
|-------|-------|-------|-----------|----------------|-------|
| **None** | Original | Original | Original | Original | Original |
| **Minimal** | Original | Year only | Original | Original | Original |
| **Standard** | Anonymized | Year only | Region only | Stripped | Excluded |
| **Full** | Anonymized | Fuzzy ranges | Generic | Stripped | Excluded |

#### 5.6.3 Selective Obfuscation Filters

**Requirement:** Apply obfuscation selectively based on individual characteristics for targeted privacy protection.

**Living Individuals Filter:**
- **Auto-detection:** Calculate if person is likely living based on birth date and death date
  - No `died` date AND (`born` within last 110 years OR no `born` date) = Presumed living
  - Configurable threshold (default: 110 years)
- **Manual override:** `cr_living: true/false` property to explicitly mark status
- **Privacy protection:** When "Living individuals only" option is enabled, obfuscate only people marked as living
- **GEDCOM standard:** Aligns with GEDCOM's "LIVING" tag convention

**Children Filter:**
- **Age-based:** Obfuscate individuals under specified age (e.g., under 18)
- **Relationship-based:** Option to obfuscate all individuals in the youngest generation
- **Custom threshold:** Configurable age threshold for minor protection
- **Combined with living filter:** Can apply both filters simultaneously

**Filter Combinations:**

| Filter Setting | Who Gets Obfuscated |
|----------------|---------------------|
| **All individuals** | Everyone in the tree |
| **Living only** | Anyone without death date or born within threshold |
| **Children only** | Anyone under age threshold |
| **Living + Children** | Union of both groups (more protective) |
| **Deceased only** | Inverse - obfuscate historical records, show living (rare use case) |

**Example Configuration:**

```yaml
# In plugin settings or export dialog
obfuscation:
  level: standard
  filters:
    living_only: true
    living_threshold_years: 110
    include_minors: true
    minor_age_threshold: 18
```

**Use Cases:**

**Legal Compliance:**
- GDPR requires explicit consent for living individuals' data
- Many jurisdictions have special protections for minors
- Some genealogical societies restrict sharing living persons' data

**Ethical Genealogy:**
- Protect privacy of living relatives who didn't consent
- Shield children from public exposure
- Share historical research without exposing current family

**Flexible Sharing:**
- Share complete historical tree (deceased only)
- Share structure with living relatives obfuscated for public demos
- Create educational materials protecting recent generations

**Obfuscation Strategies:**

**Names:**
- **Pattern-based:** "Person A", "Person B", "Person C" (maintains readability)
- **Generated:** Use common placeholder names maintaining gender/cultural context
- **Relationship-based:** "Father of Person A", "Mother of Person B"

**Dates:**
- **Year only:** `1847-03-15` → `1847`
- **Decade:** `1847-03-15` → `1840s`
- **Fuzzy ranges:** `1847-03-15` → `circa 1845-1850`
- **Relative:** Maintain age differences and generation gaps

**Locations:**
- **Region only:** "Boston, Massachusetts, USA" → "Massachusetts, USA"
- **Country only:** "Boston, Massachusetts, USA" → "USA"
- **Generic:** "Boston, Massachusetts, USA" → "Urban area, Northeast USA"

**Research Notes:**
- **Strip all:** Remove all note content
- **Summarize:** "Has 3 sources, 2 media attachments"
- **Template:** Replace with placeholder text

**Media:**
- **Exclude links:** Remove all photo/document references
- **Placeholder:** Replace with generic avatar/document icon

#### 5.6.4 Obfuscation Mapping

**Mapping File Generation:**

When obfuscation is applied, optionally generate a JSON mapping file for reversing:

```json
{
  "obfuscation_date": "2025-11-18T15:30:00Z",
  "obfuscation_level": "standard",
  "mappings": {
    "Person A": "John Robert Smith",
    "Person B": "Mary Elizabeth Jones",
    "1847": "1847-03-15",
    "Massachusetts, USA": "Boston, Massachusetts, USA"
  }
}
```

**Security Considerations:**
- Mapping file stored locally only (never included in export)
- User prompted to store in secure location
- Optional encryption of mapping file
- Clear warning that mapping file is sensitive

#### 5.6.5 Structural Integrity

**What Must Be Preserved:**
- Relationship structure (parent-child, spouse connections)
- Relative chronology (birth order, generation gaps)
- `cr_id` values (needed for graph structure)
- Number of children, spouses, generations

**Validation:**
- Obfuscated export must remain valid GEDCOM
- Relationship logic must be testable/verifiable
- Canvas rendering must remain functional

#### 5.6.6 User Interface

**Export Dialog:**
```
┌─────────────────────────────────────────┐
│ Export to GEDCOM                        │
├─────────────────────────────────────────┤
│ Obfuscation Level:                      │
│ ○ None (full data)                      │
│ ○ Minimal (year only)                   │
│ ● Standard (names + dates)              │
│ ○ Full (maximum privacy)                │
│                                         │
│ Apply to:                               │
│ ● All individuals                       │
│ ○ Living individuals only               │
│ ○ Minors only (under 18)                │
│ ○ Living individuals + Minors           │
│                                         │
│ ☑ Generate obfuscation mapping file    │
│ ☑ Include structural statistics only   │
│                                         │
│ [Cancel]              [Export GEDCOM]  │
└─────────────────────────────────────────┘
```

**Canvas Obfuscation Command:**
- Command palette: `Canvas Roots: Toggle Obfuscation Mode`
- Settings to set default obfuscation level
- Status bar indicator when active
- Automatic de-obfuscation on plugin reload

#### 5.6.7 Use Cases

**Public Sharing:**
- Share family tree structure on forums/blogs
- Demonstrate plugin functionality
- Educational examples in genealogy courses

**Collaboration:**
- Share with researchers who need structure, not PII
- Comply with privacy regulations (GDPR, etc.)
- Protect living individuals' information

**Development/Testing:**
- Create realistic test datasets
- Debug layout algorithms with real structure
- Share sample files with plugin developers

---

## 6. Enhanced Relationship Modeling

### 6.1 Multiple Spouse Support

**Requirement:** Support complex marital histories with temporal tracking

**Status:** ✅ Implemented (v0.1.1+)

#### 6.1.1 Data Structure

**Enhanced Format with Metadata (Flat, Indexed Properties):**

Uses numbered properties that are fully compatible with Obsidian's Properties panel and Obsidian Bases:

```yaml
# First spouse
spouse1: "[[Jane Doe]]"
spouse1_id: "jane-cr-id-123"
spouse1_marriage_date: "1985-06-15"
spouse1_divorce_date: "1992-03-20"
spouse1_marriage_status: divorced
spouse1_marriage_location: "Boston, MA"

# Second spouse
spouse2: "[[Mary Johnson]]"
spouse2_id: "mary-cr-id-456"
spouse2_marriage_date: "1995-08-10"
spouse2_marriage_status: current
spouse2_marriage_location: "Seattle, WA"

# Third spouse (if applicable)
spouse3: "[[Sarah Williams]]"
spouse3_id: "sarah-cr-id-789"
spouse3_marriage_date: "2005-03-22"
spouse3_marriage_status: widowed
```

**Legacy Format (Backward Compatible):**

```yaml
# Simple wikilink format (still supported)
spouse: "[[Jane Doe]]"
spouse_id: "jane-cr-id-123"

# Or array format
spouse: ["[[Jane Doe]]", "[[Mary Johnson]]"]
spouse_id: ["jane-cr-id-123", "mary-cr-id-456"]
```

**Why Flat Indexed Format:**

- ✅ **Obsidian Properties Panel:** Users can edit all fields directly in Obsidian's UI
- ✅ **Obsidian Bases Compatible:** Works seamlessly with table-based editing
- ✅ **Future-proof:** Uses only officially supported YAML structures
- ✅ **Human-readable:** Clear numbering shows marriage order at a glance

**Field Descriptions:**

| Field Pattern | Type | Required | Description |
|---------------|------|----------|-------------|
| `spouseN` | Wikilink | Yes | Link to Nth spouse's person note (N = 1, 2, 3...) |
| `spouseN_id` | String (UUID) | Yes | Spouse's `cr_id` for stable identification |
| `spouseN_marriage_date` | Date | No | Date of marriage (flexible format per §6.4) |
| `spouseN_divorce_date` | Date | No | Date of divorce/separation if applicable |
| `spouseN_marriage_status` | Enum | No | Current status: `divorced`, `widowed`, `current`, `separated`, `annulled` |
| `spouseN_marriage_location` | String | No | Place of marriage (can be wikilink to location note) |

#### 6.1.2 Backward Compatibility

**Detection Logic:**

The system detects which format is used by scanning frontmatter properties:

1. **If `spouse1` field exists:** Use enhanced flat indexed format with metadata
2. **If `spouse` or `spouse_id` exists:** Use legacy format (simple array)
3. **Parsing priority:** Enhanced format takes precedence if both exist

**Migration Path:**

Users can migrate from legacy to enhanced format at their own pace:

```yaml
# Before migration (legacy array format)
spouse: ["[[Jane Doe]]", "[[Mary Johnson]]"]
spouse_id: ["jane-cr-id-123", "mary-cr-id-456"]

# After migration (enhanced flat format - add metadata gradually)
spouse1: "[[Jane Doe]]"
spouse1_id: "jane-cr-id-123"
spouse1_marriage_status: divorced

spouse2: "[[Mary Johnson]]"
spouse2_id: "mary-cr-id-456"
spouse2_marriage_status: current
spouse2_marriage_date: "1995-08-10"
```

**No Breaking Changes:** All existing trees continue to work without modification.

#### 6.1.3 Canvas Visualization

**Multiple Spouse Positioning:**

- ✅ Spouses positioned in chronological order (marriage_order or marriage_date)
- ✅ Visual spacing between spouse groups for clarity
- ✅ All children connected to appropriate parental units
- ✅ Layout engine uses family-chart library for proper spouse handling

**Spouse Edge Display (Optional):**

By default, spouse relationships are indicated by visual positioning only (clean, minimal look). Users can optionally enable spouse edges with marriage metadata in Canvas Settings:

- ✅ **Toggle:** Show/hide spouse edges (default: hidden)
- ✅ **Label formats:**
  - None: No labels
  - Date only: "m. 1985"
  - Date and location: "m. 1985 | Boston, MA"
  - Full details: "m. 1985 | Boston, MA | div. 1992"
- ✅ **Settings location:** Control Center → Canvas Settings → Spouse edge display

**Visual Indicators (Future Enhancement):**

- Edge styling based on marriage_status:
  - Solid line: current marriage
  - Dashed line: divorced
  - Dotted line: widowed
- Color coding or icons for marriage status

**Child Association:**

When applicable, connect children to specific spousal relationships:

```yaml
# In child's note
father: "[[John Smith]]"
mother: "[[Jane Doe]]"
father_marriage_order: 1  # Child from first marriage
```

This helps clarify which children belong to which marriage.

#### 6.1.4 Implementation Status

**Phase 1: Data Model Updates** ✅ Complete

1. ✅ Added `SpouseRelationship` interface to `src/models/person.ts`:
   ```typescript
   export interface SpouseRelationship {
     personId: string;              // cr_id of spouse
     personLink?: string;           // Wikilink for display
     marriageDate?: string;         // ISO date or flexible format
     divorceDate?: string;
     marriageStatus?: 'current' | 'divorced' | 'widowed' | 'separated' | 'annulled';
     marriageLocation?: string;
     marriageOrder?: number;
   }
   ```

2. ✅ Updated `PersonNode` interface:
   ```typescript
   export interface PersonNode {
     // ... existing fields
     spouseIds: string[];                    // Legacy: simple array of cr_ids
     spouses?: SpouseRelationship[];         // Enhanced: array with metadata
   }
   ```

**Phase 2: Reading/Parsing** ✅ Complete

1. ✅ Updated `extractPersonNode()` in `src/core/family-graph.ts`:
   - Detect presence of `spouse1` field (enhanced flat indexed format)
   - Scan for all indexed spouse properties (`spouse1`, `spouse2`, `spouse3`, etc.)
   - Parse spouse metadata for each index
   - Fall back to `spouse`/`spouse_id` for legacy format
   - Populate both `spouseIds` (for compatibility) and `spouses` (for new features)

2. Handle both formats seamlessly:
   ```typescript
   // If enhanced flat indexed format exists
   if (fm.spouse1 || fm.spouse1_id) {
     node.spouses = parseIndexedSpouseRelationships(fm);
     node.spouseIds = node.spouses.map(s => s.personId);
   }
   // Otherwise fall back to legacy
   else if (fm.spouse_id || fm.spouse) {
     node.spouseIds = parseLegacySpouses(fm);
   }
   ```

3. Indexed property scanning logic:
   ```typescript
   function parseIndexedSpouseRelationships(fm: any): SpouseRelationship[] {
     const spouses: SpouseRelationship[] = [];
     let index = 1;

     // Scan for spouse1, spouse2, spouse3, etc.
     while (fm[`spouse${index}`] || fm[`spouse${index}_id`]) {
       const personId = fm[`spouse${index}_id`] || extractCrIdFromWikilink(fm[`spouse${index}`]);
       if (personId) {
         spouses.push({
           personId,
           personLink: fm[`spouse${index}`],
           marriageDate: fm[`spouse${index}_marriage_date`],
           divorceDate: fm[`spouse${index}_divorce_date`],
           marriageStatus: fm[`spouse${index}_marriage_status`],
           marriageLocation: fm[`spouse${index}_marriage_location`],
           marriageOrder: index  // Use index as implicit order
         });
       }
       index++;
     }

     return spouses;
   }
   ```

**Phase 3: Graph Building** ✅ Complete

1. ✅ Family graph traversal uses spouse metadata
2. ✅ Marriage order preserved when building tree structure
3. ✅ Spouse relationships passed to layout engine

**Phase 4: Layout Engine** ✅ Complete

1. ✅ Updated `src/core/family-chart-layout.ts`:
   - ✅ Passes spouse metadata to family-chart library
   - ✅ Uses `marriageOrder` to determine positioning sequence
   - ✅ Handles multiple spouse nodes per person

2. ✅ Layout considerations:
   - ✅ Positions spouses in order (earliest marriage first)
   - ✅ Maintains visual clarity with appropriate spacing
   - ✅ Connects children to correct parental pairs

**Phase 5: Canvas Generation** ✅ Complete

1. ✅ Updated `src/core/canvas-generator.ts`:
   - ✅ Generates nodes for all spouses
   - ✅ Creates spouse edges with optional labels
   - ✅ Positions according to layout results
   - ✅ Formats marriage metadata for edge labels

2. ✅ Canvas Settings UI (Control Center):
   - ✅ Toggle for showing/hiding spouse edges
   - ✅ Dropdown for label format selection
   - ✅ Settings persist across sessions

**Phase 6: GEDCOM Integration** ✅ Complete (Import), 🔴 Planned (Export)

1. ✅ GEDCOM importer extracts marriage metadata:
   - ✅ FAM records processed for marriage information
   - ✅ MARR tag extraction for marriage events
   - ✅ DIV tag extraction for divorce dates
   - ✅ PLAC tag extraction for locations
   - ✅ Creates flat indexed spouse properties (`spouse1_marriage_date`, etc.)

2. Export spouse metadata to GEDCOM:
   - Generate proper FAM records
   - Include MARR/DIV events
   - Maintain GEDCOM compatibility

#### 6.1.5 Testing Strategy

**Test Cases:**

1. **Legacy format only:** Ensure backward compatibility
2. **Enhanced format only:** Verify metadata parsing
3. **Mixed formats in vault:** Both formats coexist
4. **Multiple spouses:** Person with 3+ marriages
5. **Divorced + remarried:** Complex marital history
6. **Missing metadata:** Graceful degradation (marriage_date optional)
7. **Layout correctness:** Spouse positioning follows chronological order

**Test Data Files:**

Create test person notes in `test-vault/`:
- `john-smith-simple.md` - Legacy format with 2 spouses
- `john-smith-enhanced.md` - Enhanced format with full metadata
- `jane-doe-complex.md` - 3 marriages with mixed statuses

### 6.2 Multiple and Alternative Parent Relationships

**Requirement:** Track biological, adoptive, step, foster, and guardian relationships

**Extended Fields:**

```yaml
biological_father: "[[John Smith]]"
biological_mother: "[[Jane Smith]]"
adoptive_father: "[[Robert Johnson]]"
adoptive_mother: "[[Susan Johnson]]"
step_father: "[[Michael Brown]]"
step_mother: "[[Lisa Brown]]"
foster_parents:
  - "[[David Wilson]]"
  - "[[Carol Wilson]]"
guardians:
  - "[[Thomas Anderson]]"
```

**Legacy Mapping:** `father` and `mother` default to biological parents

**Visual Differentiation:**
- Different edge styles for relationship types:
  - Solid lines: biological
  - Dashed lines: adoptive
  - Dotted lines: step-parents
  - Custom colors per relationship type
- Edge labels for clarity

**Settings:** Control which parent types display by default

### 6.3 Unknown or Missing Parent Handling

**Requirement:** Represent incomplete genealogical data clearly

**Data Markers:**

```yaml
father: unknown
mother: null
father_researching: true
mother_surname_only: "O'Brien"
```

**Canvas Placeholder Nodes:**
- Optional "Unknown Father" / "Unknown Mother" nodes
- Distinct visual styling (gray, dashed border)
- Settings toggle for show/hide

**Partial Parent Data:** Store limited information when available

### 6.4 Flexible Date Precision

**Requirement:** Handle varying levels of date precision in historical records

**Supported Formats:**

| Format | Example | Precision |
|--------|---------|-----------|
| `YYYY` | `1847` | Year only |
| `YYYY-MM` | `1847-03` | Year and month |
| `YYYY-MM-DD` | `1847-03-15` | Full date |
| `~YYYY` | `~1847` | Approximate year |
| `circa YYYY` | `circa 1847` | Approximate year |
| `YYYY/YYYY` | `1847/1848` | Date range |

**Display Formatting:**
- Render based on available precision
- Examples: "1847", "March 1847", "15 March 1847"

**Date Calculations:**
- Unknown month/day defaults to mid-year or mid-month
- Age calculations handle partial dates gracefully
- Comparison operations account for precision differences

**GEDCOM Compatibility:** Align with GEDCOM date standards

### 6.5 Child Ordering and Sibling Relationships

**Requirement:** Flexible organization of children within families

**Sorting Options:**

```yaml
# Manual ordering
birth_order: 3

# Automatic sort options (global setting):
# - sort_by_age (eldest to youngest)
# - sort_by_age_reverse (youngest to eldest)
# - alphabetical
# - custom_sort_field
```

**Settings:**
- Global default sort method
- Per-person override via frontmatter

**Canvas Layout:** D3 algorithm respects child ordering when positioning horizontally

**Sibling Relationships:**

```yaml
siblings:
  - "[[Thomas Anderson]]"
  - "[[Sarah Anderson]]"
```

**Use Case:** Document sibling connections when parent relationships are unknown

### 6.6 Customizable Canvas Card Display

**Requirement:** User control over canvas node appearance

**Display Settings:**

**Property Selection:**
- Configurable list of fields to display
- Drag-to-reorder interface
- Save as global default or per-template

**Conditional Display Rules:**
- Show `died` only if person is deceased
- Show age at death if both birth and death dates available
- Show location fields only when populated
- Show relationship type badges

**Card Layout Templates:**

| Template | Contents |
|----------|----------|
| **Compact** | Name and vital dates only |
| **Standard** | Name, dates, primary locations |
| **Detailed** | All configured properties |
| **Custom** | User-defined format with placeholders |

**Example Custom Template:**

```
{{name}}
b. {{born}} - d. {{died}}
{{birth_location}}
Age: {{age_at_death}}
```

**Per-Person Overrides:**

```yaml
cr_card_template: detailed
cr_card_color: "3"
```

### 6.7 Multi-Generational Gap Handling

**Requirement:** Handle missing intermediate generations in family trees

**Grandparent Direct Links:**

```yaml
# When parent records don't exist
grandfather_paternal: "[[James Smith]]"
grandmother_paternal: "[[Mary Smith]]"
grandfather_maternal: "[[John Doe]]"
grandmother_maternal: "[[Sarah Doe]]"
```

**Canvas Visualization:**
- Show multi-generational connection with visual indicator
- Optional placeholder generation for missing intermediate parents
- Distinct edge styling (e.g., dashed lines, different colors) for generational jumps

**Data Inference:**
- Option to automatically infer missing parent relationships
- Create placeholder nodes when grandparents exist but parents don't

**Settings Toggle:** User control over displaying inferred/placeholder relationships

### 6.8 Relationship Quality and Emotional Bonds

**Requirement:** Track and visualize the quality of relationships between family members, inspired by GenoPro's genogram capabilities.

#### 6.8.1 Relationship Quality Metadata

**Data Structure:**

```yaml
relationships:
  - person: "[[John Smith]]"
    type: spouse
    quality: harmonious
    notes: "Married 50 years, very close relationship"

  - person: "[[Jane Doe]]"
    type: parent
    quality: estranged
    since: "1995"
    notes: "No contact since 1995 due to family conflict"

  - person: "[[Bob Smith]]"
    type: sibling
    quality: distant
    contact_frequency: yearly
```

**Quality Types:**

| Quality | Description | Visual Indicator |
|---------|-------------|------------------|
| `harmonious` | Close, positive relationship | Solid green edge |
| `close` | Strong bond, frequent contact | Solid blue edge |
| `neutral` | Standard relationship | Standard edge (default) |
| `distant` | Infrequent contact, weak bond | Dashed gray edge |
| `conflicted` | Active conflict, tension | Wavy orange edge |
| `estranged` | No contact, severed relationship | Dotted red edge |
| `hostile` | Active hostility or animosity | Zigzag red edge |
| `deceased_close` | Was close before death | Faded blue edge |

#### 6.8.2 Canvas Visualization

**Edge Styling:**
- **Color coding:** Different colors for relationship quality
- **Line patterns:** Solid, dashed, dotted, wavy, zigzag
- **Line thickness:** Thicker for closer relationships
- **Opacity:** Faded for historical relationships

**Hover/Click Information:**
- Display relationship metadata on edge hover
- Show quality, duration, notes
- Timeline of relationship changes if tracked

**Settings:**
- Toggle relationship quality visualization on/off
- Choose color scheme for relationship types
- Adjust edge styling preferences

#### 6.8.3 Relationship Evolution

**Temporal Tracking:**

```yaml
relationship_history:
  - person: "[[John Smith]]"
    periods:
      - from: "1985"
        to: "1990"
        quality: harmonious
        notes: "Early marriage years"
      - from: "1990"
        to: "1995"
        quality: conflicted
        notes: "Career stress period"
      - from: "1995"
        to: "2020"
        quality: harmonious
        notes: "Reconciliation and renewed closeness"
```

**Use Cases:**
- Track evolving relationships over time
- Document family dynamics and changes
- Understand patterns in family conflicts
- Therapy and family counseling contexts

### 6.9 Medical Genogram Support

**Requirement:** Track medical, genetic, and health information for genealogical health pattern analysis, inspired by GenoPro's medical genogram features.

#### 6.9.1 Health Data Structure

**Medical Conditions:**

```yaml
medical:
  conditions:
    - name: "Type 2 Diabetes"
      onset: "2010"
      severity: moderate
      status: managed

    - name: "Coronary Heart Disease"
      onset: "2015"
      severity: severe
      status: ongoing
      treatment: "Bypass surgery 2016"

  genetic_traits:
    - trait: "Blue eyes"
      inherited_from: maternal

    - trait: "Red hair"
      inherited_from: paternal

    - trait: "Left-handedness"

  cause_of_death: "Cardiac arrest"
  death_circumstances: "Sudden, at home"

  medical_history:
    - date: "2010-03"
      event: "Diagnosed with Type 2 Diabetes"
      provider: "Dr. Johnson"

    - date: "2016-08"
      event: "Coronary bypass surgery"
      hospital: "[[Massachusetts General Hospital]]"
```

#### 6.9.2 Genetic Pattern Tracking

**Inheritance Tracking:**

```yaml
genetic_markers:
  - marker: "BRCA1 mutation"
    status: positive
    tested: "2018-05"
    inherited_from: "[[Mother]]"

  - marker: "Hemochromatosis"
    status: carrier
    tested: "2019-02"
```

**Family Health Patterns:**
- Auto-detect patterns across generations
- Flag common conditions (e.g., "Diabetes appears in 3 generations")
- Highlight genetic risk factors

#### 6.9.3 Canvas Visualization

**Medical Symbols:**
- Icon overlays on person cards
- Color-coded health indicators
- Genetic trait badges

**Symbol System:**

| Condition Type | Symbol | Color |
|----------------|--------|-------|
| Heart disease | ❤️ | Red |
| Diabetes | 🔵 | Blue |
| Cancer | 🎗️ | Pink/purple |
| Mental health | 🧠 | Teal |
| Genetic marker | 🧬 | Green |
| Deceased | † | Gray |

**Genetic Inheritance Lines:**
- Special edge styling for genetic traits
- Trace inheritance paths across generations
- Show carrier status vs. affected status

#### 6.9.4 Privacy Considerations

**Medical Data Sensitivity:**
- Medical data automatically excluded from obfuscation exports by default
- Option to fully strip medical data from exports
- HIPAA-aware data handling recommendations
- Special permissions for medical data access

**Settings:**
- Toggle medical symbol display
- Control medical data export inclusion
- Set medical data obfuscation separately from other PII

#### 6.9.5 Use Cases

**Clinical Genealogy:**
- Genetic counseling and risk assessment
- Family medicine and preventive care
- Medical research and pattern analysis

**Personal Health:**
- Track family health history for medical appointments
- Understand genetic risk factors
- Plan preventive health measures

**Research:**
- Longitudinal health studies
- Genetic pattern research
- Epidemiological analysis

### 6.10 Enhanced Location and Migration Tracking

**Requirement:** Comprehensive location tracking and geographic migration pattern visualization.

#### 6.10.1 Location Data Model

**Core Location Properties:**

```yaml
locations:
  birth_place: "[[Boston, Massachusetts, USA]]"
  birth_coordinates: "42.3601,-71.0589"

  death_place: "[[Seattle, Washington, USA]]"
  death_coordinates: "47.6062,-122.3321"

  residences:
    - place: "[[New York City, New York, USA]]"
      coordinates: "40.7128,-74.0060"
      from: "1950"
      to: "1965"
      address: "123 Main Street, Manhattan"
      residence_type: rental

    - place: "[[Los Angeles, California, USA]]"
      coordinates: "34.0522,-118.2437"
      from: "1965"
      to: "1980"
      address: "456 Ocean Ave"
      residence_type: owned
      notes: "Moved for career opportunity"

  current_location: "[[Portland, Oregon, USA]]"
  current_coordinates: "45.5152,-122.6784"
```

**Migration Events:**

```yaml
migrations:
  - from: "[[Ireland]]"
    to: "[[United States]]"
    date: "1890"
    reason: "Irish Potato Famine emigration"
    port_of_entry: "[[Ellis Island, New York]]"
    ship: "SS Celtic"

  - from: "[[Italy]]"
    to: "[[Argentina]]"
    date: "1910"
    reason: "Economic opportunity"
    traveling_with:
      - "[[Giuseppe Romano]]"
      - "[[Maria Romano]]"
```

#### 6.10.2 Geographic Visualization

**Map Integration:**
- Link to external mapping services (Google Maps, OpenStreetMap)
- Show migration routes on separate canvas view
- Timeline view with geographic distribution

**Canvas Features:**
- Color-code person nodes by birth location region
- Migration path edges between parent/child nodes
- Cluster view showing family members by location

**Migration Patterns:**
- Visualize family diaspora over generations
- Show emigration/immigration waves
- Track urbanization patterns

#### 6.10.3 Place Notes

**Centralized Place Management:**

Create dedicated Place notes with standardized structure:

```yaml
# In Places/Boston-Massachusetts.md
---
place_type: city
coordinates: "42.3601,-71.0589"
country: "[[United States]]"
region: "[[Massachusetts]]"
aliases: ["Boston", "Beantown"]
---

## People Born Here
- [[John Smith]]
- [[Jane Doe]]

## People Who Lived Here
- [[Bob Johnson]] (1950-1965)

## Historical Context
Founded in 1630, Boston was a major center for...
```

**Benefits:**
- Centralized location information
- Easy queries by place
- Historical context for locations
- Automatic backlinks to people

#### 6.10.4 Use Cases

**Migration Research:**
- Track family immigration patterns
- Document refugee and displacement histories
- Understand cultural diaspora

**Social History:**
- Urbanization trends within families
- Economic migration patterns
- Regional cultural influence

**Medical Correlation:**
- Environmental health factors by location
- Regional disease patterns
- Climate and health correlations

---

## 6.5. Context Menu Actions

**Status:** 🔴 Planned (v0.1.2-alpha)

**Purpose:** Provide quick-access context menu actions for person notes, folders, and canvas files to streamline common workflows.

### 6.5.1 Person Note Context Menu

Right-click actions for person notes (files with `cr_id` frontmatter):

**"Add relationship..." (Submenu):**
- **"Add parent"** - Opens PersonPicker, adds selected person to `father`/`mother` field
- **"Add spouse"** - Opens PersonPicker, adds selected person to next available `spouseN` field
- **"Add child"** - Opens PersonPicker, adds selected person to `children` array
- All actions update both wikilink and `_id` fields (dual storage)
- Shows success Notice with relationship details

**"Validate relationships":**
- Checks all `_id` references (father_id, mother_id, spouse_id, children_id)
- Verifies each `cr_id` exists in vault
- Identifies orphaned wikilinks (link exists but no matching `cr_id`)
- Displays results in modal with "Jump to note" buttons for each issue
- Shows success Notice if no issues found

**"Find on canvas":**
- Searches all `.canvas` files for nodes containing this person's file path
- If found: opens canvas and centers viewport on the node
- If multiple canvases: shows selection modal
- If not found: shows Notice "Person not found on any canvas"

### 6.5.2 Folder Context Menu

Right-click actions for folders:

**"Set as people folder":**
- Updates `settings.peopleFolder` to clicked folder's path
- Saves settings
- Shows Notice: "People folder set to: [folder path]"
- Simple one-click alternative to manual settings configuration

**"Import GEDCOM to this folder":**
- Opens GEDCOM import dialog (Data Entry tab)
- Pre-fills target folder field with clicked folder path
- User proceeds with normal GEDCOM import workflow

**"Scan for relationship issues":**
- Batch validation of all person notes (files with `cr_id`) in folder
- Same validation logic as individual "Validate relationships"
- Displays summary modal:
  - Total person notes scanned
  - Number of files with issues
  - List of issues grouped by file
  - "Jump to note" buttons
- Progress indicator for large folders

### 6.5.3 Canvas File Context Menu

Right-click actions for `.canvas` files (in addition to existing "Regenerate canvas"):

**"Show tree statistics":**
- Displays modal with canvas metadata and computed statistics:
  - Canvas name
  - Root person (from canvas metadata)
  - Total nodes (person count)
  - Total edges (relationship count)
  - Generation depth (max distance from root)
  - Tree type (ancestors/descendants/full)
  - Generation limit (if applicable)
  - Spouse inclusion setting
  - Created date (from canvas metadata if available)
- Read-only information display
- Simple, lightweight implementation

### 6.5.4 Implementation Notes

**Technical Approach:**
- All actions registered via `workspace.on('file-menu')` event
- Person note actions: check for `cr_id` in metadata cache before showing
- Folder actions: check if TFolder, show for all folders
- Canvas actions: check for `.canvas` extension
- Reuse existing components: PersonPicker, Notice, Modal classes

**UI Guidelines:**
- Add separator before Canvas Roots menu items
- Use Lucide icons for visual clarity
- Group related actions together
- Follow Obsidian's context menu patterns

**Error Handling:**
- Validate file/folder existence before operations
- Show user-friendly error messages via Notice
- Log errors to console with context
- Gracefully handle edge cases (empty folders, invalid canvases)

---

## 7. World-Building and Organizational Features

**Purpose:** Extend Canvas Roots beyond traditional genealogy to support fantasy world-building, historical dynasties, corporate succession tracking, and institutional evolution.

### 7.1 Visual Grouping and Styling Rules

**Requirement:** Apply conditional visual styling to canvas nodes based on custom properties, enabling multi-dimensional family tree analysis.

#### 7.1.1 Property-Based Grouping

**Data Structure:**

```yaml
# In person notes
kingdom: "[[House Stark]]"
lineage: "direct"
succession_status: "eligible"
allegiance: "[[The North]]"
house: "[[Stark]]"
region: "[[Winterfell]]"
```

**Grouping Criteria:**

| Criterion | Description | Use Case |
|-----------|-------------|----------|
| **Kingdom/House** | Political affiliation | Royal dynasties, noble houses |
| **Lineage Type** | Direct vs. cadet branches | Succession eligibility visualization |
| **Geographic Region** | Location-based grouping | Regional power dynamics |
| **Allegiance** | Factional loyalty | Civil wars, political divisions |
| **Social Class** | Nobility, commoner, clergy | Class-based analysis |
| **Organization** | Corporate divisions, departments | Organizational charts |

#### 7.1.2 Styling Rules Engine

**Settings Configuration:**

```yaml
# In plugin settings
styling_rules:
  - name: "House Colors"
    property: kingdom
    type: background_color
    mappings:
      "[[House Stark]]": "#808080"
      "[[House Lannister]]": "#FFD700"
      "[[House Targaryen]]": "#DC143C"
      "[[House Baratheon]]": "#000000"

  - name: "Succession Eligibility"
    property: succession_status
    type: border_style
    mappings:
      "eligible": "solid 3px gold"
      "excluded": "dashed 1px gray"
      "contested": "dotted 2px red"

  - name: "Direct Lineage Indicator"
    property: lineage
    type: icon_overlay
    mappings:
      "direct": "👑"
      "cadet": "🛡️"
      "bastard": "⚔️"
```

**Visual Properties:**

- **Background color:** Distinguish houses, factions, organizations
- **Border styling:** Indicate status, eligibility, role
- **Icon overlays:** Add symbolic indicators
- **Node size:** Emphasize importance or power level
- **Text color:** Improve contrast and readability
- **Opacity:** De-emphasize extinct lines or minor branches

#### 7.1.3 Multiple Overlay System

**Requirement:** Toggle between different visual grouping schemes without recreating the tree.

**Implementation:**

- **Preset Overlays:** Save multiple styling rule sets
- **Quick Toggle:** Keyboard shortcuts or UI buttons to switch
- **Layer Combination:** Apply multiple overlays simultaneously

**Example Overlays:**

| Overlay Name | Visual Scheme | Purpose |
|--------------|---------------|---------|
| **House Allegiance** | Color by kingdom/house | Political structure |
| **Succession Lines** | Border styles by eligibility | Inheritance tracking |
| **Geographic Regions** | Color by location | Regional power analysis |
| **Living vs. Deceased** | Opacity by status | Current vs. historical |
| **Generation Depth** | Gradient by distance from root | Chronological visualization |

**Canvas Display:**
- Overlay selector toolbar in Canvas view
- Legend panel showing current color/style mappings
- Non-destructive visual changes (original data unchanged)

### 7.2 Dual Relationship Trees

**Requirement:** Display two different relationship types simultaneously on the same Canvas, supporting both biological and organizational/political connections.

#### 7.2.1 Relationship Type System

**Data Structure:**

```yaml
# Biological relationships (traditional)
father: "[[Tywin Lannister]]"
mother: "[[Joanna Lannister]]"

# Organizational/political relationships
political_predecessor: "[[Robert Baratheon]]"
political_successor: "[[Tommen Baratheon]]"
mentor: "[[Jon Arryn]]"
heir_designated: "[[Joffrey Baratheon]]"
```

**Relationship Categories:**

| Category | Edge Type | Use Cases |
|----------|-----------|-----------|
| **Biological** | `father`, `mother`, `children` | Traditional genealogy |
| **Political** | `predecessor`, `successor`, `heir` | Royal succession |
| **Organizational** | `reports_to`, `manages`, `replaced_by` | Corporate charts |
| **Mentorship** | `mentor`, `apprentice`, `teacher` | Knowledge transfer |
| **Legal** | `guardian`, `ward`, `adoptive_parent` | Guardianship chains |

#### 7.2.2 Dual Tree Visualization

**Display Modes:**

1. **Overlay Mode:** Show both relationship types on same canvas with different edge styles
2. **Side-by-Side Mode:** Split canvas showing two separate trees
3. **Comparison Mode:** Highlight where biological and political lines diverge

**Edge Differentiation:**

```yaml
# Visual styling for relationship types
edge_styles:
  biological:
    color: "#4A90E2"
    style: solid
    width: 2
    label: ""

  political:
    color: "#E24A4A"
    style: dashed
    width: 2
    label: "👑"

  organizational:
    color: "#4AE290"
    style: dotted
    width: 2
    label: "🏢"
```

**Canvas Features:**
- Toggle biological/political edges on/off
- Filter to show only one relationship type
- Highlight nodes where relationships diverge
- Show combined path from root person through both trees

#### 7.2.3 Use Cases

**Historical Dynasties:**
- Show biological descent vs. actual succession
- Track usurpations, elective monarchies, non-hereditary transfers
- Example: "Charlemagne → biological children vs. actual Holy Roman Emperors"

**Corporate Succession:**
- Biological family ownership vs. management hierarchy
- Track family businesses across generations
- Show professional vs. familial relationships

**Fantasy World-Building:**
- Game of Thrones-style succession with multiple claimants
- Track rightful vs. actual rulers
- Show mentor chains alongside bloodlines

**Institutional Evolution:**
- Academic lineages (advisor → student)
- Religious leadership (biological vs. spiritual succession)
- Craft guilds (master → apprentice vs. family inheritance)

### 7.3 Succession Rules Engine

**Requirement:** Support complex, customizable succession rules beyond simple parent-to-child inheritance.

#### 7.3.1 Rule Definition System

**Data Structure:**

```yaml
# In settings or per-organization notes
succession_rules:
  - name: "Salic Law"
    description: "Male-preference primogeniture, excludes females"
    query: |
      gender: male
      AND parent: [current_ruler]
      ORDER BY: birth_date ASC
      LIMIT: 1

  - name: "Agnatic-Cognatic Primogeniture"
    description: "Male preference, females if no males"
    priority:
      - filter: "gender: male AND parent: [current_ruler]"
        order: "birth_date ASC"
      - filter: "gender: female AND parent: [current_ruler]"
        order: "birth_date ASC"

  - name: "Matrilineal Succession"
    description: "Inheritance through female line only"
    query: |
      gender: female
      AND mother: [current_ruler]
      ORDER BY: birth_date ASC
      LIMIT: 1

  - name: "Elective Monarchy"
    description: "Chosen from eligible candidates"
    query: |
      eligibility: eligible
      AND house: [current_house]
      ORDER BY: votes DESC, influence DESC
```

#### 7.3.2 Complex Query Support

**Query Language Features:**

```yaml
# Example: "Next male descended from this woman through any path"
succession_query:
  base: "[[Queen Elizabeth]]"
  filter: "gender: male"
  path: "descendant"
  lineage: "matrilineal"
  order: "proximity ASC, age DESC"
  exclude:
    - "succession_excluded: true"
    - "house: [[Enemy House]]"
```

**Supported Operators:**

| Operator | Purpose | Example |
|----------|---------|---------|
| `AND`, `OR`, `NOT` | Logical combinations | `gender: male AND NOT excluded: true` |
| `ORDER BY` | Priority sorting | `ORDER BY birth_date ASC, proximity DESC` |
| `LIMIT` | Result count | `LIMIT 1` (single heir) or `LIMIT 5` (council) |
| `FILTER` | Conditional filtering | `house: [[Current Dynasty]]` |
| `PATH` | Relationship traversal | `descendant`, `matrilineal`, `patrilineal` |

#### 7.3.3 Canvas Visualization

**Succession Highlighting:**
- Highlight eligible candidates based on current rule
- Show succession order with numerical badges
- Visual path from current ruler to next heir
- Display excluded candidates with distinct styling

**Rule Comparison View:**
- Show different heirs under different succession laws
- Side-by-side comparison of Salic vs. Agnatic-Cognatic
- Historical "what-if" analysis

**Settings:**
- Select active succession rule
- Toggle succession visualization on/off
- Configure custom rules in UI

#### 7.3.4 Use Cases

**Historical Analysis:**
- Track wars of succession
- Analyze dynastic disputes
- Compare cultural succession traditions

**World-Building:**
- Define fantasy kingdom inheritance laws
- Create alien species succession rituals
- Model post-apocalyptic leadership transfer

**Organizational:**
- CEO succession planning
- Board member rotation rules
- Academic department chair selection

### 7.4 Co-Ruling and Shared Positions

**Requirement:** Visualize situations where multiple individuals share power, rule jointly, or hold regencies.

#### 7.4.1 Co-Ruling Data Model

**Data Structure:**

```yaml
# Co-ruling configuration
rulership:
  - title: "King of England"
    rulers:
      - person: "[[William III]]"
        role: primary
      - person: "[[Mary II]]"
        role: co_ruler
    from: "1689"
    to: "1694"
    type: joint_sovereignty

  - title: "Roman Emperor"
    rulers:
      - person: "[[Marcus Aurelius]]"
        role: senior_augustus
      - person: "[[Lucius Verus]]"
        role: junior_augustus
    from: "161 CE"
    to: "169 CE"
    type: co_emperorship
```

**Co-Ruling Types:**

| Type | Description | Historical Examples |
|------|-------------|---------------------|
| **Joint Sovereignty** | Equal co-rulers | William & Mary of England |
| **Senior/Junior** | Hierarchical co-rule | Roman co-emperors |
| **Regency** | Temporary rule during minority | Queen Mother regencies |
| **Triumvirate** | Rule by committee of 3+ | First Triumvirate (Rome) |
| **Dual Monarchy** | Separate crowns, same person | Personal unions |
| **Consort Rule** | Spouse with shared power | Spanish Catholic Monarchs |

#### 7.4.2 Regency and Guardianship

**Data Structure:**

```yaml
# Regency during minority or incapacity
regency:
  - ward: "[[Henry VI of England]]"
    regent: "[[Humphrey, Duke of Gloucester]]"
    from: "1422"
    to: "1437"
    reason: minority
    regent_title: "Lord Protector"

  - ward: "[[Louis IX of France]]"
    regent: "[[Blanche of Castile]]"
    from: "1226"
    to: "1234"
    reason: minority
    relationship: mother
```

**Regency Types:**
- **Minority:** Child ruler with adult regent
- **Incapacity:** Illness or absence
- **Interim:** Between deaths/abdications
- **Ceremonial:** Symbolic rulership

#### 7.4.3 Canvas Visualization

**Co-Ruler Nodes:**
- **Linked nodes:** Visual connector between co-rulers
- **Merged node:** Single node with multiple portraits/names
- **Hierarchical positioning:** Senior above junior rulers
- **Temporal indicators:** Show duration of joint rule

**Regency Indicators:**
- **Overlay badge:** Crown with "R" for regent
- **Dotted connection:** Ward to regent
- **Timeline bar:** Show regency duration
- **Age indicator:** Display ward's age during regency

**Visual Styles:**

```yaml
co_ruler_style:
  node_grouping: true
  connection_type: "thick horizontal bar"
  shared_title_display: true
  individual_dates: true

regency_style:
  regent_badge: "R"
  edge_style: "dotted"
  edge_color: "purple"
  temporal_overlay: true
```

#### 7.4.4 Triumvirate and Council Rule

**Multi-Person Governance:**

```yaml
# Triumvirate or ruling council
governance:
  - body: "First Triumvirate"
    members:
      - "[[Julius Caesar]]"
      - "[[Pompey]]"
      - "[[Crassus]]"
    from: "60 BCE"
    to: "53 BCE"
    type: informal_alliance

  - body: "Swiss Federal Council"
    members:
      - "[[Member 1]]"
      - "[[Member 2]]"
      # ... (7 members total)
    from: "1848"
    to: "present"
    type: collegial_government
    rotation: true
    rotating_president: true
```

**Canvas Features:**
- Cluster visualization for councils
- Radial layout around central institution node
- Show member rotation over time
- Highlight rotating presidency

### 7.5 Organizational Evolution and Timeline Branching

**Requirement:** Track organizations, kingdoms, corporations, and institutions as they merge, split, are conquered, or evolve over time.

#### 7.5.1 Organizational Entity Model

**Data Structure:**

```yaml
# Organization/institution as a separate entity type
organization:
  name: "Kingdom of Mercia"
  type: kingdom
  founded: "527 CE"
  dissolved: "918 CE"
  predecessor_of: "[[Kingdom of England]]"
  absorbed_by: "[[Wessex]]"
  territories:
    - "[[East Midlands]]"
    - "[[West Midlands]]"
  rulers:
    - person: "[[Penda of Mercia]]"
      from: "626"
      to: "655"
    - person: "[[Offa of Mercia]]"
      from: "757"
      to: "796"
```

#### 7.5.2 Merger and Split Events

**Data Structure:**

```yaml
# Organizational transformations
transformations:
  - type: merger
    date: "1707"
    entities_merged:
      - "[[Kingdom of England]]"
      - "[[Kingdom of Scotland]]"
    result: "[[Kingdom of Great Britain]]"
    legal_basis: "Acts of Union 1707"

  - type: split
    date: "1776"
    source: "[[British Empire]]"
    results:
      - entity: "[[United States of America]]"
        reason: independence
      - entity: "[[British Empire]]"
        status: continued

  - type: conquest
    date: "1066"
    conqueror: "[[Norman Duchy]]"
    conquered: "[[Kingdom of England]]"
    result: "[[Norman England]]"
    ruler: "[[William the Conqueror]]"

  - type: partition
    date: "1947"
    source: "[[British India]]"
    results:
      - "[[India]]"
      - "[[Pakistan]]"
    reason: "Independence and religious partition"
```

#### 7.5.3 Canvas Visualization

**Timeline Branching:**
- **Horizontal timeline:** Organizations as horizontal nodes
- **Split visualization:** Single node branches into multiple
- **Merge visualization:** Multiple nodes converge into one
- **Conquest overlay:** Show dominance relationships

**Organizational Node Styling:**

```yaml
org_node_style:
  shape: rectangular
  size: larger_than_person_nodes
  border: double_line
  color: distinct_from_people
  icon: institution_symbol
```

**Relationship Edges:**

| Edge Type | Visual Style | Meaning |
|-----------|--------------|---------|
| `preceded_by` | Dotted arrow | Institutional succession |
| `absorbed_by` | Solid arrow with X | Merger/conquest |
| `split_into` | Branching arrow | Division/partition |
| `ruled_by` | Dashed line | Governance connection |
| `allied_with` | Double line | Alliance/partnership |

#### 7.5.4 Corporate and Business Use Cases

**Company Evolution:**

```yaml
company:
  name: "Standard Oil"
  founded: "1870"
  founder: "[[John D. Rockefeller]]"
  split_date: "1911"
  split_reason: "Antitrust ruling"
  successors:
    - "[[Standard Oil of New Jersey]]" # (Exxon)
    - "[[Standard Oil of New York]]" # (Mobil)
    - "[[Standard Oil of California]]" # (Chevron)
    - "[[Standard Oil of Indiana]]" # (Amoco)
```

**Modern Mergers:**

```yaml
merger:
  date: "2015"
  companies:
    - "[[Kraft Foods]]"
    - "[[Heinz]]"
  result: "[[Kraft Heinz Company]]"
  ceo: "[[Bernardo Hees]]"
  market_cap: "$100 billion"
```

#### 7.5.5 Canvas Features

**Timeline View:**
- Horizontal organizational timeline
- Show splits, mergers, conquests chronologically
- Person nodes connected to organizational nodes
- Filter by organization type (kingdom, corporation, institution)

**Dual Layer Display:**
- Bottom layer: Organizational entities and evolution
- Top layer: Individual rulers/leaders/CEOs
- Connections between person and organization layers

**Query System:**
- "Show all successors of Roman Empire"
- "Display corporate family tree of Standard Oil"
- "Track territory changes of Kingdom of France 800-1800"

### 7.6 Use Case Examples

#### 7.6.1 Fantasy World-Building

**Scenario:** Game of Thrones-style dynasty tracking

**Features Used:**
- Visual grouping by house (§7.1)
- Dual biological/political trees (§7.2)
- Custom succession rules (§7.3)
- Co-ruling visualization (§7.4)
- Kingdom evolution (§7.5)

**Implementation:**

```yaml
# Targaryen succession with multiple claimants
person: "[[Daenerys Targaryen]]"
house: "[[House Targaryen]]"
succession_claim: legitimate
biological_father: "[[Aerys II Targaryen]]"
political_predecessor: null  # Usurped throne
rivals:
  - "[[Jon Snow]]"  # Better biological claim
  - "[[Cersei Lannister]]"  # Current holder
```

#### 7.6.2 Historical Dynasty Research

**Scenario:** European royal succession analysis

**Features Used:**
- Multiple overlays for different time periods (§7.1.3)
- Salic law vs. Agnatic-Cognatic rules (§7.3)
- Personal unions and co-rulership (§7.4)
- Kingdom mergers (§7.5)

**Example:** Habsburg dynasty tracking across Spain, Austria, Holy Roman Empire

#### 7.6.3 Corporate Succession Planning

**Scenario:** Family business transfer across generations

**Features Used:**
- Dual trees: biological family + management hierarchy (§7.2)
- Organizational evolution: company splits/mergers (§7.5)
- Custom succession rules: primogeniture vs. merit-based (§7.3)

**Implementation:**

```yaml
company: "[[Smith & Sons Manufacturing]]"
founder: "[[Robert Smith]]"
current_ceo: "[[Jennifer Smith]]"
succession_plan:
  rule: "primogeniture with board approval"
  candidates:
    - "[[Michael Smith]]"  # Eldest child
    - "[[Sarah Smith]]"  # Most qualified
```

#### 7.6.4 Civilization Evolution

**Scenario:** Rise and fall of empires over millennia

**Features Used:**
- Organizational timeline (§7.5)
- Conquest and partition visualization (§7.5.2)
- Migration tracking (§6.10)
- Geographic grouping (§7.1)

**Example:** Roman Republic → Roman Empire → Eastern/Western split → Byzantine Empire

---

## Appendix A: Implementation Priorities

### MVP (Minimum Viable Product)
- Core data model (§2.1.1)
- Bidirectional link automation (§2.2)
- Tree generation command (§3.1)
- Basic D3 layout engine (§3.5.3)
- Canvas JSON read/write (§4.3)
- Canvas metadata support (§3.5.4)
- **Collection Management - Foundation** (§3.4)
  - Auto-discovery of collections from folders
  - Collection and tree data model with UUIDs
  - Basic collection codes (auto-generated)
  - Disconnected tree detection
- **Control Center Modal - MVP** (§3.6.9)
  - Modal structure with navigation drawer
  - Status tab (basic stats)
  - Collections tab (list collections, basic info)
  - Quick Actions tab (Generate Tree, Re-Layout)
  - Data Entry tab (Create new persons with "Add Another" workflow)
  - Material components library (Card, Button, Slider)
  - Basic CSS styling

### Phase 2
- Re-layout command (§3.2)
- **Tree Visualization - D3 Preview** (§3.5)
  - Tree View component (custom Obsidian view)
  - D3 interactive SVG rendering
  - Layout settings panel with live preview
  - Generate to Canvas from preview
- **Collection Management - Enhanced** (§3.4)
  - Collection settings panel
  - Tree code customization
  - Manual collection creation
  - Collection statistics
- **Reference Numbering with Collection Codes** (§2.1.3, §3.4.4)
  - Reference numbering systems (Dollarhide-Cole, Ahnentafel)
  - Integration with collection/tree codes
  - Format: {collection_code}/{tree_code}/{ref_num}
- GEDCOM import Mode 1 (§5.2)
- Flexible date precision (§6.4)
- Basic card customization (§6.6)
- **Control Center - Phase 2** (§3.6.9)
  - Tree Generation tab with all settings
  - Enhanced Collections tab with tree management
  - Filter controls
  - Properties tab for configurable property names

### Phase 3
- **Enhanced Canvas View** (§3.5.2)
  - Optional Canvas wrapper with dataset browser
  - Collection/tree context display
  - Quick switching between collections
- **Query-Based Collections** (§3.4.3)
  - Custom collections using Dataview-style queries
  - Tag-based filtering
  - Cross-folder collections
- GEDCOM import Mode 2 (§5.2)
- GEDCOM export with UUID preservation, collection codes (§5.3, §5.5.4, §3.4.4)
- Multi-vault merging with collection matching (§5.5, §3.4)
- Basic obfuscation (export only) (§5.6)
- Multiple spouse support (§6.1)
- Alternative parent relationships (§6.2)
- Unknown parent handling (§6.3)
- **Control Center - Phase 3** (§3.6.9)
  - GEDCOM tab (import/export)
  - Merge collections interface

### Phase 4
- Advanced obfuscation (canvas mode, all levels) (§5.6)
- Person Detail Panel (§3.3)
- Child ordering (§6.5)
- Advanced card templates (§6.6)
- Multi-generational gaps (§6.7)
- DataView template library (§5.4)
- Basic location tracking (§6.10)
- **Control Center - Phase 4** (§3.4.9)
  - Person Detail tab integration
  - Advanced settings organization

### Phase 5 (GenoPro-Inspired Features)
- Relationship quality visualization (§6.8)
- Medical genogram support (§6.9)
- Enhanced migration tracking (§6.10.2)
- Place note system (§6.10.3)
- Genetic pattern analysis (§6.9.2)
- Medical privacy controls (§6.9.4)

### Phase 6 (World-Building and Organizational Features)
- Visual grouping and styling rules (§7.1)
- Property-based grouping and overlays (§7.1.1-7.1.3)
- Dual relationship trees (§7.2)
- Succession rules engine (§7.3)
- Co-ruling and regency visualization (§7.4)
- Organizational evolution tracking (§7.5)
- Timeline branching for institutions (§7.5.2-7.5.3)
- **Control Center - Phase 6** (§3.4.9)
  - Advanced feature tabs as implemented
  - Progressive enhancement of existing tabs

---

## 8. Multi-Family Tree UX Enhancements

### 8.1 Overview

When a vault contains multiple disconnected family trees (common in multi-family GEDCOMs or research vaults), users need better tools to understand, navigate, and generate trees for all family groups.

**Current Implementation (v0.1.0):**
- Full Family Tree only shows people connected to selected root
- Persistent notice informs user about disconnected families
- Users must manually generate separate trees for each family group

**Proposed Enhancements:** Improve discoverability and workflow for multi-family scenarios

---

### 8.2 Component Detection

**Status:** ✅ Implemented (foundation)

The `FamilyGraphService.findAllFamilyComponents()` method detects disconnected family groups using breadth-first traversal.

**Returns:**
```typescript
Array<{
  representative: PersonNode;  // Oldest person or first alphabetically
  size: number;                // Number of people in component
  people: PersonNode[];        // All people in component
}>
```

**Use Cases:**
- Power "Generate All Trees" command
- Display family group indicators in person picker
- Show component summary before tree generation

---

### 8.3 Generate All Trees Command

**Status:** ✅ Implemented

**Priority:** High
**Complexity:** Moderate
**Actual Effort:** ~45 minutes

**Description:**
Add a command that automatically generates separate canvas files for all disconnected family groups in one operation.

**User Interface:**
```
Command Palette: "Canvas Roots: Generate all family trees"

Workflow:
1. Detect all family components
2. For each component:
   - Generate Full Family Tree from representative person
   - Save as "Family Tree - {RepresentativeName}.canvas"
3. Show summary notice: "Generated 6 family trees (48, 32, 28, 19, 18, 18 people)"
```

**Benefits:**
- One-command workflow for multi-family GEDCOMs
- Immediate visibility into all family groups
- Saves manual effort of generating each tree

**Implementation Notes:**
- ✅ Reuses existing tree generation logic
- ✅ Uses component representative (oldest person by birth date) as root for each tree
- ✅ Applies naming convention: `Family Tree {N} - {Name}.canvas` (numbered for clarity)
- ✅ Command added to main.ts with ID `generate-all-trees`
- ✅ Handles errors gracefully, continues with remaining trees if one fails
- ✅ Shows progress notices and final summary

**Implementation Details:**
- Location: [main.ts:149-160](../../main.ts#L149-L160) (command registration)
- Location: [control-center.ts:268-364](../ui/control-center.ts#L268-L364) (implementation)
- Validates vault has multiple components before proceeding
- Generates full family tree (unlimited generations, includes spouses)
- Creates/overwrites canvas files with numbered names

---

### 8.4 Family Group Indicator in Person Picker

**Status:** ✅ Implemented

**Priority:** Medium
**Complexity:** Moderate-High
**Actual Effort:** ~45 minutes

**Description:**
Visually group people by family component in the person picker modal, helping users understand which people are connected.

**User Interface:**
```
┌─────────────────────────────────────┐
│ Select root person                  │
├─────────────────────────────────────┤
│ 🔍 Search...                        │
├─────────────────────────────────────┤
│ Family Group 1 (45 people)          │
│   • William Anderson (1905-1982)    │
│   • Margaret O'Brien (1908-1995)    │
│   • Robert Anderson (1930-2010)     │
│   ...                               │
│                                     │
│ Family Group 2 (15 people)          │
│   • Carlos Johnson (1920-2001)      │
│   • Maria Martinez (1925-2008)      │
│   ...                               │
└─────────────────────────────────────┘
```

**Benefits:**
- Clear visual separation of disconnected families
- Helps users select representative from correct family
- Shows family sizes at a glance

**Implementation Notes:**
- ✅ Calls `findAllFamilyComponents()` when loading people
- ✅ Builds component map (cr_id → component index) for fast lookups
- ✅ Groups filtered people by component before rendering
- ✅ Renders section headers with family group number and size
- ✅ Gracefully degrades to flat list when only one component exists
- ✅ Maintains all existing filtering and sorting functionality

**Implementation Details:**
- Location: [person-picker.ts:98-119](../ui/person-picker.ts#L98-L119) (component detection)
- Location: [person-picker.ts:391-430](../ui/person-picker.ts#L391-L430) (grouped rendering)
- CSS: [modals.css:609-637](../../styles/modals.css#L609-L637) (group header styles)

---

### 8.5 Post-Generation Action Button

**Priority:** High
**Complexity:** Low
**Estimated Effort:** 15-20 minutes

**Description:**
Add an actionable button to the disconnected family notice that opens a picker for generating trees from remaining family groups.

**User Interface:**
```
Current notice:
┌──────────────────────────────────────────┐
│ Full Family Tree shows 45 of 60 people. │
│                                          │
│ 15 people are not connected to William   │
│ Anderson through family relationships.   │
│                                          │
│ This usually means your vault has        │
│ multiple separate family trees...        │
│                                          │
│ [Generate Other Trees] [Dismiss]        │
└──────────────────────────────────────────┘

Clicking "Generate Other Trees":
- Opens modal listing remaining components
- User selects which to generate
- Generates selected trees
```

**Benefits:**
- Actionable next step from notice
- Reduces friction for multi-family workflows
- Complements existing notice

**Implementation Notes:**
- Modify Notice to include button (may need custom Notice)
- Button triggers component picker modal
- Generate trees for selected components

---

### 8.6 Pre-Generation Component Summary

**Priority:** Medium
**Complexity:** High
**Estimated Effort:** 60-90 minutes

**Description:**
Show summary of family components before tree generation, allowing user to choose which to generate.

**User Interface:**
```
When user selects "Generate Tree" from Control Center:

┌────────────────────────────────────────────┐
│ Family Trees in Vault                      │
├────────────────────────────────────────────┤
│ This vault contains 2 disconnected family  │
│ trees. Select which to generate:           │
│                                            │
│ ☑ Anderson family (45 people)             │
│   Root: William Anderson (1905-1982)      │
│                                            │
│ ☐ Martinez/Johnson family (15 people)     │
│   Root: Carlos Johnson (1920-2001)        │
│                                            │
│ [Generate Selected] [Generate All] [Back] │
└────────────────────────────────────────────┘
```

**Benefits:**
- Proactive information before generation
- User choice over which trees to create
- Prevents surprise at partial results

**Implementation Notes:**
- Check components before tree generation
- If multiple components exist, show picker
- Allow multi-select or "Generate All" option
- Skip picker if only one component

---

### 8.7 Settings Configuration

**Priority:** Low
**Complexity:** Low
**Estimated Effort:** 20-30 minutes

**Description:**
Add setting for default behavior when encountering multi-family vaults.

**User Interface:**
```
Settings > Canvas Roots > Multi-Family Handling

When vault contains multiple family trees:
( ) Show notice only (current)
( ) Ask which families to generate
( ) Auto-generate all families

☐ Always show component summary before generation
```

**Benefits:**
- User control over default behavior
- Power users can auto-generate all trees
- Casual users can keep notice-only approach

**Implementation Notes:**
- Add to CanvasRootsSettings interface
- Check setting in tree generation workflow
- Apply appropriate behavior based on setting

---

### 8.8 Implementation Priority

**Completed:**
- ✅ **§8.2 Component Detection** - Foundation for all multi-family features
- ✅ **§8.3 Generate All Trees Command** - One-command workflow for multi-family GEDCOMs
- ✅ **§8.4 Family Group Indicator** - Visual grouping in person picker modal

**Remaining (Recommended Order):**
1. **§8.5 Post-Generation Action Button** (adapted - command reference in notice) - ✅ Already addressed
2. **§8.7 Settings Configuration** (quick, medium value) - 20-30 min
3. **§8.6 Pre-Generation Summary** (complex, high value long-term) - 60-90 min

**Rationale:**
Start with §8.5 (action button) as the quickest high-impact improvement. This complements the existing notice and provides immediate next steps for users. Add visual polish with §8.4 (family group indicators) to help users understand component structure. Settings (§8.7) give power users control. Save complex modal flows (§8.6) for when user feedback validates the approach.

---

## Appendix B: Related Documentation

- **Architecture Overview:** [docs/architecture/overview.md](docs/architecture/overview.md)
- **Code Style Guide:** [docs/assets/templates/documentation-style-guide.md](docs/assets/templates/documentation-style-guide.md)
- **Original Spec (Archived):** [docs/archive/canvas-roots-initial-spec.md](docs/archive/canvas-roots-initial-spec.md)

---

## Appendix C: Glossary

| Term | Definition |
|------|------------|
| **Canvas** | Obsidian's infinite canvas feature for visual organization |
| **Control Center** | Material Design modal interface providing centralized access to all Canvas Roots features |
| **D3.js** | JavaScript library for data visualization and layout algorithms |
| **GEDCOM** | Genealogical Data Communication - standard format for family tree data |
| **Frontmatter** | YAML metadata block at the top of Markdown files |
| **Dataview** | Popular Obsidian plugin for querying and displaying note metadata |
| **Bidirectional Link** | Reciprocal relationship links between two notes |
| **cr_id** | Canvas Roots unique identifier for each person |

---

**End of Specification**
