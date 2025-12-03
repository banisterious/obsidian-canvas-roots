# Relationship Tools

This page covers tools for analyzing and organizing family relationships: the relationship calculator, reference numbering systems, lineage tracking, and relationship history.

## Relationship Calculator

Calculate the genealogical relationship between any two people in your family tree using proper genealogical terminology.

### How It Works

The Relationship Calculator uses BFS (breadth-first search) pathfinding to find the shortest connection path between two people, then translates that path into standard genealogical relationship terms.

### Accessing the Calculator

**Method 1: Command Palette**
1. Press `Ctrl/Cmd + P`
2. Type "Canvas Roots: Calculate relationship between people"
3. Select the first person
4. Select the second person
5. View the result

**Method 2: Context Menu**
1. Right-click on a person note
2. Select **Calculate relationship**
3. Select the second person to compare
4. View the result

### Understanding Results

**Direct Relationships:**
- Parent, child, grandparent, great-grandparent, etc.
- Sibling, half-sibling
- Uncle/aunt, nephew/niece, great-uncle/great-aunt

**Collateral Relationships (Cousins):**
- 1st cousin, 2nd cousin, 3rd cousin, etc.
- Removals: "1st cousin once removed", "2nd cousin twice removed"
- Common ancestor identification

**In-Law Relationships:**
- Parent-in-law, child-in-law
- Sibling-in-law
- Other in-law connections

### Relationship Path

The calculator displays the complete path showing how two people are connected:

```
John Smith → Mary Smith (spouse) → Robert Jones (father) → Alice Jones
```

This helps you understand the chain of relationships connecting two individuals.

### Copy to Clipboard

Click **Copy result** to copy the relationship description for use in notes or documentation.

## Reference Numbering Systems

Canvas Roots supports standard genealogical numbering systems for organizing and referencing individuals in your family tree.

### Supported Systems

**Ahnentafel (Ancestor Numbering):**
The Ahnentafel system assigns numbers to ancestors starting from a reference person:
- Person = 1
- Father = 2, Mother = 3
- Paternal grandfather = 4, Paternal grandmother = 5
- Maternal grandfather = 6, Maternal grandmother = 7
- Pattern: Father = 2N, Mother = 2N+1

**d'Aboville (Descendant Numbering with Dots):**
Numbers descendants using dot notation:
- Root person = 1
- Children = 1.1, 1.2, 1.3
- Grandchildren = 1.1.1, 1.1.2, 1.2.1
- Each dot level represents a generation

**Henry System (Compact Descendant Numbering):**
Similar to d'Aboville but without dots:
- Root person = 1
- Children = 11, 12, 13
- Grandchildren = 111, 112, 121
- More compact but less readable for large numbers

**Generation Numbering:**
Assigns relative generation depth from a reference person:
- Reference person = 0
- Parents = -1, Grandparents = -2
- Children = +1, Grandchildren = +2

### Assigning Reference Numbers

**Via Command Palette:**
1. Press `Ctrl/Cmd + P`
2. Type "Canvas Roots: Assign [system] numbers"
3. Select the reference/root person
4. Numbers are assigned to all related individuals

**Via Context Menu:**
1. Right-click on a person note
2. Select **Reference numbers** submenu
3. Choose the numbering system
4. Numbers are assigned from that person

### Where Numbers Are Stored

Reference numbers are stored in frontmatter properties:
- `ahnentafel`: Ahnentafel number
- `daboville`: d'Aboville number (e.g., "1.2.3")
- `henry`: Henry system number (e.g., "123")
- `generation`: Generation depth number

### Clearing Reference Numbers

**Via Command Palette:**
1. Press `Ctrl/Cmd + P`
2. Type "Canvas Roots: Clear reference numbers"
3. Select which numbering type to clear
4. Numbers are removed from all person notes

### Using Numbers in Bases

Reference numbers appear in Bases views automatically:
- Sort by Ahnentafel number to see ancestor order
- Filter by generation number to focus on specific generations
- Use d'Aboville/Henry for descendant reports

## Lineage Tracking

Track multi-generational lineages from root persons, enabling you to mark people as belonging to specific ancestral lines.

### What Is Lineage Tracking?

Lineage tracking lets you mark people as belonging to named ancestral lines (e.g., "Smith Line", "Tudor Dynasty"). This is useful for:
- Tracking descent from notable ancestors
- Organizing multi-family research
- Identifying which lineage(s) a person belongs to
- Filtering views by ancestral line

### Lineage Types

**Patrilineal (Father's Line):**
Tracks descendants through male lines only (father → son → grandson).

**Matrilineal (Mother's Line):**
Tracks descendants through female lines only (mother → daughter → granddaughter).

**All Descendants:**
Tracks all descendants regardless of gender (includes everyone descended from the root person).

### Assigning Lineages

**Via Context Menu:**
1. Right-click on a person note (usually a notable ancestor)
2. Select **Assign lineage from this person**
3. Choose lineage type (Patrilineal, Matrilineal, or All descendants)
4. Enter a lineage name (e.g., "Smith Line") - suggested name based on surname
5. All qualifying descendants receive the lineage tag

**Via Command Palette:**
1. Press `Ctrl/Cmd + P`
2. Type "Canvas Roots: Assign lineage from root person"
3. Select the root person
4. Choose lineage type and enter name

### Multiple Lineage Membership

A person can belong to multiple lineages:
```yaml
---
lineage:
  - "Smith Line"
  - "Jones Family"
  - "Tudor Dynasty"
---
```

This occurs when:
- Someone has ancestors from multiple tracked lineages
- You've run lineage assignment multiple times with different root persons

### Removing Lineage Tags

**Via Command Palette:**
1. Press `Ctrl/Cmd + P`
2. Type "Canvas Roots: Remove lineage tags"
3. Select which lineage to remove (or all lineages)
4. Tags are removed from all person notes

### Using Lineages in Bases

The `lineage` property appears in Bases views:
- Filter by lineage to see all members of an ancestral line
- Use the "By lineage" view in the included Base template
- Cross-reference lineages to find common ancestry

## Relationship History & Undo

Canvas Roots tracks all relationship changes, allowing you to review history and undo mistakes.

### Enabling History Tracking

History tracking is enabled by default. Configure in Settings → Canvas Roots → Data:
- **Enable relationship history**: Master toggle
- **History retention days**: How long to keep history (default: 30 days)

### Viewing Relationship History

**Via Command Palette:**
1. Press `Ctrl/Cmd + P`
2. Type "Canvas Roots: View relationship history"
3. Review recent changes

**History Modal Shows:**
- Chronological list of all relationship changes
- Change type (add parent, add spouse, remove child, etc.)
- Person affected and related person
- Timestamp of each change
- Statistics by change type

### Undoing Changes

**Undo Most Recent Change:**
1. Press `Ctrl/Cmd + P`
2. Type "Canvas Roots: Undo last relationship change"
3. Confirm the undo

**Undo Specific Change:**
1. Open relationship history modal
2. Find the change you want to undo
3. Click the **Undo** button next to that entry
4. The change is reversed in both person notes

### What Gets Tracked

- Adding/removing parent relationships
- Adding/removing spouse relationships
- Adding/removing child relationships
- Changes via Control Center, context menus, Bases, or direct frontmatter edits

### Automatic Cleanup

Old history entries are automatically removed based on your retention setting:
- Default: 30 days
- Configure in Settings → Canvas Roots → Data
- Set to 0 for unlimited retention (not recommended for large trees)
