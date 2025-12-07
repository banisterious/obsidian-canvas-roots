# Organization Notes

Organization Notes allow you to track non-genealogical hierarchies such as noble houses, guilds, corporations, military units, and religious orders. People can be members of organizations with roles and temporal membership data.

## Overview

Organizations are a distinct note type separate from person notes. They support:

- **Hierarchy**: Organizations can have parent organizations, creating nested structures
- **Memberships**: People can belong to multiple organizations with roles and date ranges
- **Types**: 8 built-in organization types with distinct colors and icons
- **Universe Scoping**: Organizations can be scoped to specific fictional universes

## Creating Organization Notes

### Using the Command

1. Open the Command Palette (Ctrl/Cmd + P)
2. Search for "Canvas Roots: Create organization note"
3. Fill in the organization details in the modal

### Using the Control Center

1. Open the Control Center (Ctrl/Cmd + Shift + R)
2. Go to the **Organizations** tab
3. Click **Create organization**
4. Fill in the form fields

### Manual Creation

Create a note with the following frontmatter:

```yaml
---
cr_type: organization
cr_id: org-house-stark
name: House Stark
org_type: noble_house
parent_org: "[[The North]]"
founded: "Age of Heroes"
motto: "Winter is Coming"
seat: "[[Winterfell]]"
universe: westeros
---
```

## Organization Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | string | Yes | Must be `organization` |
| `cr_id` | string | Yes | Unique identifier (auto-generated) |
| `name` | string | Yes | Organization display name |
| `org_type` | string | Yes | Category (see types below) |
| `parent_org` | wikilink | No | Parent organization in hierarchy |
| `founded` | string | No | Founding date (supports fictional dates) |
| `dissolved` | string | No | Dissolution date |
| `motto` | string | No | Organization motto or slogan |
| `seat` | wikilink | No | Primary location (link to place note) |
| `universe` | string | No | Universe scope |

## Organization Types

Canvas Roots includes 8 built-in organization types:

| Type ID | Display Name | Color | Icon | Use Case |
|---------|--------------|-------|------|----------|
| `noble_house` | Noble house | Purple | Crown | Feudal houses, dynasties |
| `guild` | Guild | Orange | Hammer | Trade guilds, craftsmen |
| `corporation` | Corporation | Blue | Building | Modern companies |
| `military` | Military unit | Red | Shield | Armies, regiments, navies |
| `religious` | Religious order | Gold | Church | Churches, monasteries |
| `political` | Political entity | Green | Landmark | Kingdoms, republics |
| `educational` | Educational | Teal | Graduation cap | Schools, universities |
| `custom` | Custom | Gray | Building | User-defined |

### Hiding Built-in Types

In the Organizations tab, toggle "Show built-in types" to hide the default types and only show custom organization types you've defined.

## Person Memberships

People can have memberships in organizations through the `memberships` array in their frontmatter.

### Membership Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `org` | wikilink | Yes | Link to organization note |
| `org_id` | string | No | Organization `cr_id` for robust linking |
| `role` | string | No | Role or position within organization |
| `from` | string | No | Start date of membership |
| `to` | string | No | End date (leave empty if current) |
| `notes` | string | No | Additional context |

### Example Person Frontmatter

```yaml
---
name: Eddard Stark
cr_id: person-eddard-stark
memberships:
  - org: "[[House Stark]]"
    org_id: org-house-stark
    role: Lord of Winterfell
    from: "283 AC"
    to: "298 AC"
  - org: "[[Small Council]]"
    org_id: org-small-council
    role: Hand of the King
    from: "298 AC"
    to: "298 AC"
---
```

### Adding Memberships

#### Via Context Menu

1. Right-click a person note in the file explorer
2. Select **Canvas Roots** → **Add organization membership...**
3. Select the organization and fill in details

#### Via Add Relationship Modal

The Add Membership modal provides:
- Organization dropdown (sorted alphabetically)
- Role field for position or title
- From/To date fields (support fictional date formats)
- Notes field for additional context

## Organizations Tab

The Control Center includes a dedicated **Organizations** tab with:

### Organizations Card
- Lists all organizations grouped by type
- Color-coded indicators for each type
- Shows member count and sub-organization count
- Click organization name to open the note

### Statistics Card
- Total organizations count
- People with memberships count
- Total memberships count
- Breakdown by organization type

### Organization Types Card
- Table of available organization types
- Color swatches and icons
- Toggle to show/hide built-in types

### Data Tools Card
- Create organizations base template button

## Bases Integration

Canvas Roots includes a pre-configured Bases template for organizations with 17 views:

### Creating the Template

1. Open Command Palette
2. Run "Canvas Roots: Create organizations base template"
3. The template creates `organizations.base` in your vault

### Available Views

| View | Description |
|------|-------------|
| All Organizations | Every organization sorted by name |
| By Type | Grouped by organization type |
| Noble Houses | Only noble house type |
| Guilds | Only guild type |
| Corporations | Only corporation type |
| Military Units | Only military type |
| Religious Orders | Only religious type |
| Political Entities | Only political type |
| Educational | Only educational type |
| Active Organizations | Organizations without dissolution date |
| Dissolved Organizations | Organizations with dissolution date |
| By Universe | Grouped by universe |
| Top-Level Organizations | Organizations without parent |
| Sub-Organizations | Organizations with parent, grouped by parent |
| By Collection | Grouped by collection tag |
| With Seat | Organizations with seat location defined |
| Missing Seat | Organizations without seat location |

### Formulas

The template includes these formulas:
- `display_name`: Shows `name` or falls back to filename
- `is_active`: Shows "Yes" or "No" based on dissolution status
- `hierarchy_path`: Shows full path like "Parent → Child"

## Commands

| Command | Description |
|---------|-------------|
| Create organization note | Opens modal to create a new organization |
| Open organizations tab | Opens Control Center to Organizations tab |
| Create organizations base template | Creates the Bases template file |

## Context Menu Actions

### Person Notes
- **Add organization membership...**: Add a membership to the selected person

### Folder Context Menu
- **Bases** → **New organizations base from template**: Create the Bases template in the folder

## Use Cases

### Tracking Noble Houses
Create organizations for each noble house in your world. Link them hierarchically (vassal houses under liege lords) and add person memberships with roles like "Lord", "Heir", "Castellan".

### Corporate Structure
Model companies with departments as sub-organizations. Track employees' positions and tenure with from/to dates.

### Military Units
Create organizations for regiments, divisions, and armies. Track soldiers' ranks and service periods.

### Religious Orders
Model churches, monasteries, and religious hierarchies. Track clergy positions and affiliations.

## Best Practices

### Use Consistent Type Assignment
Choose the most appropriate organization type for each organization to enable effective filtering and visualization.

### Link Parent Organizations
When creating sub-organizations, always link to the parent organization to build the hierarchy.

### Use Universe Scoping
For fictional organizations, set the `universe` property to enable filtering by fictional world.

### Include Membership Dates
When adding memberships, include from/to dates to track temporal changes in affiliations.

### Use cr_id for Memberships
Include the `org_id` in membership entries for robust linking that survives organization renames.

## Integration with Other Features

### Custom Relationships
Organizations can complement custom relationships. For example, a "liege/vassal" relationship between people might correlate with their house memberships.

### Fictional Date Systems
Organization founded/dissolved dates and membership from/to dates fully support fictional date formats from your custom calendar systems.

### Places
Organization seats link to place notes, connecting your organizational hierarchy to your geographic data.

### Universe Filtering
When filtering by universe, organizations are scoped appropriately to show only those relevant to the selected fictional world.
