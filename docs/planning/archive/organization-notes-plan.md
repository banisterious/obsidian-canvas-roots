# Organization Notes & Hierarchy Views Implementation Plan

## Overview

Organization Notes enable users to define and track non-genealogical hierarchies such as noble houses, guilds, corporations, military units, and religious orders. People can be members of organizations with roles and temporal membership data.

## MVP Scope (v0.7.0)

The initial implementation focuses on **organization notes and person memberships** with Bases integration. Advanced visualization (D3 org charts) is deferred.

### In Scope
- Organization note type with frontmatter schema
- Person membership in organizations (single and multiple)
- Organization hierarchy (parent organizations)
- Organization types (noble_house, guild, corporation, military, religious, custom)
- Control Center UI for organization management
- Bases integration for organizations and memberships
- Context menu actions for organizations

### Deferred (v0.8.0+)
- D3-based org chart visualizations
- Temporal membership filtering ("who was a member in year X?")
- Organization succession/leadership tracking
- Heraldry/coat of arms support
- Export to org chart formats (PDF, SVG)
- Canvas visualization of organization hierarchies

---

## Schema Design

### Organization Note

A new note type `type: organization` with standardized frontmatter:

```yaml
---
type: organization
cr_id: org-house-stark
name: House Stark
org_type: noble_house
parent_org: "[[The North]]"
founded: "Age of Heroes"
dissolved: null
motto: "Winter is Coming"
seat: "[[Winterfell]]"
universe: westeros
---
```

### Organization Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | string | Yes | Must be `organization` |
| `cr_id` | string | Yes | Unique identifier (auto-generated) |
| `name` | string | Yes | Organization display name |
| `org_type` | string | Yes | Category (see types below) |
| `parent_org` | wikilink | No | Parent organization in hierarchy |
| `founded` | string | No | Founding date (supports fictional dates) |
| `dissolved` | string | No | Dissolution date |
| `motto` | string | No | Organization motto/slogan |
| `seat` | wikilink | No | Primary location (link to place note) |
| `universe` | string | No | Universe scope |

### Organization Types

| Type ID | Display Name | Color | Use Case |
|---------|--------------|-------|----------|
| `noble_house` | Noble House | Purple | Feudal houses, dynasties |
| `guild` | Guild | Orange | Trade guilds, craftsmen |
| `corporation` | Corporation | Blue | Modern companies |
| `military` | Military Unit | Red | Armies, regiments, navies |
| `religious` | Religious Order | Gold | Churches, monasteries |
| `political` | Political Entity | Green | Kingdoms, republics |
| `educational` | Educational | Teal | Schools, universities |
| `custom` | Custom | Gray | User-defined |

### Person Membership

People reference organizations in their frontmatter:

```yaml
---
name: Eddard Stark
cr_id: person-eddard-stark
# Simple membership (current, primary organization)
house: "[[House Stark]]"
role: Lord of Winterfell

# Multiple/historical memberships
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

### Membership Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `org` | wikilink | Yes | Link to organization note |
| `org_id` | string | Yes | Organization cr_id for robust linking |
| `role` | string | No | Role/position within organization |
| `from` | string | No | Start date of membership |
| `to` | string | No | End date of membership |
| `notes` | string | No | Additional context |

---

## Implementation Phases

### Phase 1: Organization Note Type

**Files:**
- `src/organizations/types/organization-types.ts` - Type definitions
- `src/organizations/constants/organization-types.ts` - Built-in org types
- `src/organizations/index.ts` - Module exports

**Type Definitions:**
```typescript
interface OrganizationInfo {
  file: TFile;
  crId: string;
  name: string;
  orgType: OrganizationType;
  parentOrg?: string;        // cr_id of parent
  parentOrgLink?: string;    // wikilink
  founded?: string;
  dissolved?: string;
  motto?: string;
  seat?: string;             // wikilink to place
  universe?: string;
}

interface OrganizationTypeDefinition {
  id: string;
  name: string;
  color: string;
  icon: LucideIconName;
  builtIn: boolean;
}

type OrganizationType =
  | 'noble_house' | 'guild' | 'corporation'
  | 'military' | 'religious' | 'political'
  | 'educational' | 'custom';
```

### Phase 2: Organization Service

**Files:**
- `src/organizations/services/organization-service.ts` - CRUD operations
- Update `src/services/data-service.ts` - Include organizations in data loading

**OrganizationService class:**
```typescript
class OrganizationService {
  constructor(plugin: CanvasRootsPlugin);

  // Get all organizations
  getAllOrganizations(): OrganizationInfo[];

  // Get organization by cr_id
  getOrganization(crId: string): OrganizationInfo | null;

  // Get child organizations
  getChildOrganizations(parentCrId: string): OrganizationInfo[];

  // Get organization hierarchy (ancestors)
  getOrganizationHierarchy(crId: string): OrganizationInfo[];

  // Get members of an organization
  getMembers(orgCrId: string): PersonMembership[];

  // Create new organization note
  createOrganization(name: string, orgType: OrganizationType, folder?: string): Promise<TFile>;
}
```

### Phase 3: Person Membership

**Files:**
- `src/organizations/services/membership-service.ts` - Membership operations
- Update `src/services/person-service.ts` - Include membership data

**MembershipService class:**
```typescript
class MembershipService {
  constructor(plugin: CanvasRootsPlugin);

  // Get all memberships for a person
  getPersonMemberships(personCrId: string): PersonMembership[];

  // Get current/primary organization
  getPrimaryOrganization(personCrId: string): OrganizationInfo | null;

  // Add membership to person
  addMembership(personFile: TFile, membership: MembershipData): Promise<void>;

  // Remove membership from person
  removeMembership(personFile: TFile, orgCrId: string): Promise<void>;
}

interface PersonMembership {
  person: PersonInfo;
  org: OrganizationInfo;
  role?: string;
  from?: string;
  to?: string;
  isCurrent: boolean;
}
```

### Phase 4: Control Center UI

**Files:**
- `src/organizations/ui/organizations-tab.ts` - New Control Center tab
- Update `src/ui/control-center.ts` - Register tab
- Update `src/ui/lucide-icons.ts` - Add tab config

**Organizations Tab Cards:**

1. **Organizations Card**
   - List of all organizations grouped by type
   - Click to open organization note
   - Quick actions: Edit, View members
   - Filter by type, universe

2. **Organization Types Card**
   - Table of available organization types
   - Color swatches and icons
   - Toggle to show/hide built-in types
   - Add custom type button

3. **Hierarchy Card**
   - Tree view of organization hierarchy
   - Collapsible nodes
   - Click to navigate

4. **Statistics Card**
   - Total organizations
   - Members per organization
   - Breakdown by type

### Phase 5: Context Menu and Commands

**Files:**
- Update `src/ui/context-menu.ts` - Add organization actions
- Update `src/commands.ts` - Register commands

**Context Menu (Organization Note):**
- View members
- View in hierarchy
- Add child organization
- Edit organization

**Context Menu (Person Note):**
- Add membership...
- View memberships

**Commands:**
- `Charted Roots: Create organization note`
- `Charted Roots: Open organizations tab`
- `Charted Roots: Add membership to current person`

### Phase 6: Bases Integration

**Updates:**
- Organization notes appear in Bases with org-specific columns
- Person notes show membership columns
- Filter/sort by organization, role, membership dates

**Organization Columns:**
- org_type, parent_org, founded, dissolved, seat

**Person Columns:**
- house (simple), memberships (array), role

---

## UI Mockups

### Organizations Tab

```
┌─────────────────────────────────────────────────────────┐
│ [🏛️ Organizations]                                      │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Organizations                         [+ Create]   │ │
│ ├─────────────────────────────────────────────────────┤ │
│ │ Filter: [All types ▼] [All universes ▼] [Search…]  │ │
│ │                                                     │ │
│ │ NOBLE HOUSES                                        │ │
│ │ ┌───────────────────────────────────────────────┐   │ │
│ │ │ 🏰 House Stark           Lord of Winterfell   │   │ │
│ │ │    5 members · westeros              [→]      │   │ │
│ │ └───────────────────────────────────────────────┘   │ │
│ │ ┌───────────────────────────────────────────────┐   │ │
│ │ │ 🏰 House Lannister       Warden of the West   │   │ │
│ │ │    8 members · westeros              [→]      │   │ │
│ │ └───────────────────────────────────────────────┘   │ │
│ │                                                     │ │
│ │ MILITARY UNITS                                      │ │
│ │ ┌───────────────────────────────────────────────┐   │ │
│ │ │ ⚔️ Night's Watch                              │   │ │
│ │ │    12 members · westeros             [→]      │   │ │
│ │ └───────────────────────────────────────────────┘   │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Statistics                                          │ │
│ ├─────────────────────────────────────────────────────┤ │
│ │ Total organizations: 15                             │ │
│ │ People with memberships: 42                         │ │
│ │                                                     │ │
│ │ By type:                                            │ │
│ │   Noble houses: 8                                   │ │
│ │   Military units: 4                                 │ │
│ │   Religious orders: 3                               │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Create Organization Modal

```
┌─────────────────────────────────────────────────────────┐
│ Create Organization                                [×]  │
├─────────────────────────────────────────────────────────┤
│ Name: [House Stark_________________________]            │
│                                                         │
│ Type: [Noble House ▼]                                   │
│                                                         │
│ Parent organization: [None_________________] [Select]   │
│                                                         │
│ Universe: [westeros________________________] (optional) │
│                                                         │
│ Folder: [Organizations/_____________________]           │
│                                                         │
│ ─────────────────────────────────────────────────────   │
│ Optional details:                                       │
│                                                         │
│ Founded: [Age of Heroes____________________]            │
│ Motto:   [Winter is Coming_________________]            │
│ Seat:    [None_____________________________] [Select]   │
│                                                         │
│                              [Cancel]  [Create]         │
└─────────────────────────────────────────────────────────┘
```

### Add Membership Modal

```
┌─────────────────────────────────────────────────────────┐
│ Add Membership                                     [×]  │
│ Adding membership for: Eddard Stark                     │
├─────────────────────────────────────────────────────────┤
│ Organization: [None_______________________] [Select]    │
│                                                         │
│ Role: [Lord of Winterfell__________________]            │
│                                                         │
│ From: [283 AC______________________________] (optional) │
│ To:   [____________________________________] (optional) │
│                                                         │
│ Notes: [___________________________________]            │
│        [___________________________________]            │
│                                                         │
│                              [Cancel]  [Add]            │
└─────────────────────────────────────────────────────────┘
```

---

## Integration Points

### With Custom Relationships
- Organizations can have custom relationships (alliance, rivalry)
- Liege/vassal relationships between people often correlate with organization membership

### With Fictional Date Systems
- Organization founded/dissolved dates support fictional formats
- Membership from/to dates support fictional formats

### With Places
- Organization seats link to place notes
- Place notes can list organizations headquartered there

### With Universes
- Organizations are scoped to universes
- Filter organizations by universe

---

## Testing Strategy

### Unit Tests
- Organization parsing from frontmatter
- Membership array parsing
- Hierarchy traversal
- Type validation

### Integration Tests
- Create organization flow
- Add membership flow
- Control Center display
- Bases column display

### Manual Testing
- Create organization hierarchy
- Add multiple memberships to person
- Filter by organization type
- Navigate hierarchy

---

## File Structure

```
src/organizations/
├── index.ts                           # Module exports
├── types/
│   └── organization-types.ts          # Type definitions
├── constants/
│   └── organization-types.ts          # Built-in org types
├── services/
│   ├── organization-service.ts        # Organization CRUD
│   └── membership-service.ts          # Membership operations
└── ui/
    ├── organizations-tab.ts           # Control Center tab
    ├── create-organization-modal.ts   # Create modal
    └── add-membership-modal.ts        # Membership modal
```

---

## Estimated Effort

| Phase | Effort |
|-------|--------|
| Phase 1: Organization Note Type | Small |
| Phase 2: Organization Service | Medium |
| Phase 3: Person Membership | Medium |
| Phase 4: Control Center UI | Medium |
| Phase 5: Context Menu and Commands | Small |
| Phase 6: Bases Integration | Small |

**Total: Medium-sized feature**

---

## Open Questions

1. Should organization notes support a `members` array (denormalized) or rely solely on person→org links?
2. How to handle leadership succession (e.g., "current lord" vs historical lords)?
3. Should we support organization-to-organization relationships beyond parent/child?

---

## References

- [Roadmap: Organization Notes](../../wiki-content/Roadmap.md#organization-notes--hierarchy-views)
- [Custom Relationship Types Plan](./custom-relationship-types-plan.md) - Similar feature structure
- [Fictional Date Systems Plan](./fictional-date-systems-plan.md) - Date integration
