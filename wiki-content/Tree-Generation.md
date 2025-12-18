# Tree Generation

This page covers how to generate family tree visualizations on the Obsidian Canvas.

---

## Table of Contents

- [Step 1: Open Control Center](#step-1-open-control-center)
- [Step 2: Navigate to Tree Generation Tab](#step-2-navigate-to-tree-generation-tab)
- [Step 3: Select Root Person](#step-3-select-root-person)
- [Step 4: Configure Tree Options](#step-4-configure-tree-options)
- [Step 5: Generate](#step-5-generate)
- [Layout Algorithms Explained](#layout-algorithms-explained)
- [Next Steps](#next-steps)

---

## Step 1: Open Control Center

**Method 1: Command Palette**
1. Press `Ctrl/Cmd + P`
2. Type "Canvas Roots: Open Control Center"
3. Press Enter

**Method 2: Ribbon Icon (if enabled)**
- Click the Canvas Roots icon in the left sidebar

## Step 2: Navigate to Tree Generation Tab

Click the **Tree Generation** tab at the top of the Control Center modal.

## Step 3: Select Root Person

**Using the Person Browser:**
1. **Search**: Type in the search box to filter by name
2. **Sort**: Click column headers to sort by name or birth year
3. **Click**: Select any person as the tree's root
4. Birth/death years appear next to names for identification

**Using Family Groups (Multi-Family Vaults):**
- If you have disconnected family groups, use the sidebar
- Shows "Family 1", "Family 2", etc. with person counts
- Click any family to select its representative person

## Step 4: Configure Tree Options

### Tree Type

- **Ancestors**: Shows parents, grandparents, etc. (pedigree chart)
- **Descendants**: Shows children, grandchildren, etc.
- **Full**: Shows both ancestors and descendants

### Generations

- **All generations**: Include everyone related to root person
- **Limit generations**: Set maximum number of generations (1-10)

### Spouses

- **Include spouses**: Show spouse relationships in the tree
- **Exclude spouses**: Show only blood relationships

### Layout

- **Vertical**: Generations flow top-to-bottom (traditional pedigree)
- **Horizontal**: Generations flow left-to-right (compact for wide screens)

### Layout Algorithm

- **Standard**: Default family-chart layout with proper spouse handling (default spacing)
- **Compact**: 50% tighter spacing for large trees (ideal for 50+ people)
- **Timeline**: Chronological positioning by birth year (X-axis = time, Y-axis = generation)
- **Hourglass**: Root person centered with ancestors above and descendants below

### Spacing

- **Horizontal spacing**: Distance between nodes side-by-side
- **Vertical spacing**: Distance between generations
- Adjust in Canvas Settings tab

### Source Indicators

Display badges showing how many source notes link to each person:

- **Show source indicators**: Toggle in Settings → Canvas Roots → Canvas styling
- When enabled, nodes show badges like "📎 3" indicating 3 linked sources
- **Color coding**: Green for 3+ sources (well-documented), yellow for 1-2 sources
- Only appears on nodes that have at least one linked source
- Source notes are identified by `type: source` in their frontmatter

This feature helps visualize research quality at a glance—nodes without badges may need more documentation.

## Step 5: Generate

### Single Tree

1. Enter an optional canvas name (defaults to "Family Tree - [Root Person]")
2. Click **Generate family tree**
3. Canvas opens automatically

### All Trees (Multi-Family Vaults)

1. Click **Generate all trees**
2. Creates separate canvas for each disconnected family group
3. Files named "Family Tree [N] - [Representative Name].canvas"

The plugin calculates optimal positions using the [family-chart](https://github.com/donatso/family-chart) library and creates the canvas.

## Layout Algorithms Explained

### Standard Layout

The default algorithm optimized for most family trees:
- Properly positions spouses side-by-side
- Balances ancestors and descendants
- Good for trees up to ~50 people

### Compact Layout

50% tighter spacing for larger trees:
- Reduces horizontal and vertical gaps
- Better for trees with 50+ people
- May require more zooming to read individual nodes

### Timeline Layout

Positions people chronologically by birth year:
- X-axis represents time (earlier births on left)
- Y-axis represents generation
- Useful for visualizing when family members lived relative to each other

### Hourglass Layout

Centers the root person with ancestors above and descendants below:
- Root person in the middle
- Parents, grandparents flow upward
- Children, grandchildren flow downward
- Good for showing a person's complete context

## Next Steps

- [Tree Preview](Tree-Preview) - Preview your tree before generating
- [Family Chart View](Family-Chart-View) - Interactive view for exploring trees
- [Styling & Theming](Styling-And-Theming) - Customize tree appearance
