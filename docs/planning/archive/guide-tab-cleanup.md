# Guide Tab Cleanup - Planning Document

## Current State

The Guide tab currently contains **19 cards** spanning ~976 lines of code. It's become a comprehensive reference rather than a quick start guide.

### Current Cards

| Card | Lines | Purpose |
|------|-------|---------|
| Welcome to Charted Roots | ~20 | Intro text |
| Quick start | ~45 | 3-step overview |
| Essential person note properties | ~30 | Property list |
| Essential place note properties | ~30 | Property list |
| Essential map note properties | ~30 | Property list |
| Custom maps for fictional worlds | ~90 | 5-step tutorial |
| Schema reference | ~10 | Link to docs |
| Understanding groups and collections | ~70 | Concept explanation |
| Marking root people | ~50 | Feature guide |
| Layout algorithms | ~70 | 4 algorithm descriptions |
| Advanced collections features | ~45 | Color scheme, overview, filtering |
| Per-canvas style customization | ~60 | Style override guide |
| GEDCOM export | ~45 | Export guide |
| Supported import formats | ~65 | 4 format descriptions |
| Bidirectional relationship sync | ~65 | Sync feature guide |
| Split canvas wizard | ~50 | Wizard guide |
| Common tasks | ~65 | Navigation links |
| Templater integration | ~55 | Template guide |
| Pro tips | ~20 | Tips list |

## Problems

1. **Too long** - Users must scroll extensively to find information
2. **Mixed purposes** - Combines getting started, reference, and advanced features
3. **Duplicates wiki** - Much content now exists in the wiki
4. **No external links** - Doesn't leverage the wiki for deep dives

## Proposed Restructure

Reduce to **5 focused cards** that provide quick orientation and link to the wiki for details.

### Card 1: Welcome & Quick Start

Combine welcome and quick start into one compact card:
- Brief description (1-2 sentences)
- 3-step quick start with tab links
- Link to wiki Getting Started page

### Card 2: Essential Properties

Collapsed/accordion view of property lists:
- Person properties (collapsed by default)
- Place properties (collapsed by default)
- Map properties (collapsed by default)
- Link to Frontmatter Reference wiki page

### Card 3: Key Concepts

Brief overview of important concepts with wiki links:
- Groups vs Collections (2-3 sentences + wiki link)
- Root people (2-3 sentences + wiki link)
- Bidirectional sync (2-3 sentences + wiki link)

### Card 4: Common Tasks

Keep the navigation grid but make it more prominent:
- Import data → Import/Export tab
- Generate tree → Tree Output tab
- Create person → People tab
- Create place → Places tab
- Customize styling → Canvas Settings tab
- Open Map View → launches map

### Card 5: Learn More

Links to wiki and resources:
- Wiki quick links (Getting Started, Data Entry, Tree Generation, etc.)
- Templater templates button (opens modal)
- Pro tips (collapsed)

## Implementation

### Step 1: Create collapsed/accordion component

Add CSS and helper for collapsible sections:

```typescript
private createCollapsible(container: HTMLElement, title: string, content: () => void): void {
  const header = container.createDiv({ cls: 'crc-collapsible__header' });
  header.createEl('span', { text: title });
  const icon = header.createDiv({ cls: 'crc-collapsible__icon' });
  setLucideIcon(icon, 'chevron-right', 14);

  const body = container.createDiv({ cls: 'crc-collapsible__body crc-hidden' });
  content.call(this, body);

  header.addEventListener('click', () => {
    body.toggleClass('crc-hidden', !body.hasClass('crc-hidden'));
    icon.empty();
    setLucideIcon(icon, body.hasClass('crc-hidden') ? 'chevron-right' : 'chevron-down', 14);
  });
}
```

### Step 2: Rewrite showGuideTab

Replace the 976-line method with a ~200-line streamlined version.

### Step 3: Add wiki links

Use external links to wiki pages:

```typescript
const wikiLink = content.createEl('a', {
  text: 'Learn more in the wiki →',
  href: 'https://github.com/banisterious/obsidian-charted-roots/wiki/Data-Entry',
  cls: 'crc-link external-link'
});
wikiLink.setAttr('target', '_blank');
```

## Content Mapping

| Current Card | New Location |
|--------------|--------------|
| Welcome | Card 1: Welcome & Quick Start |
| Quick start | Card 1: Welcome & Quick Start |
| Person properties | Card 2: Essential Properties (collapsed) |
| Place properties | Card 2: Essential Properties (collapsed) |
| Map properties | Card 2: Essential Properties (collapsed) |
| Custom maps tutorial | Wiki: Geographic-Features (link from Card 5) |
| Schema reference | Card 2: Essential Properties (link) |
| Groups and collections | Card 3: Key Concepts (brief + wiki link) |
| Root people | Card 3: Key Concepts (brief + wiki link) |
| Layout algorithms | Wiki: Tree-Generation (link from Card 5) |
| Advanced collections | Wiki: Advanced-Features (link from Card 5) |
| Per-canvas styles | Wiki: Styling-And-Theming (link from Card 5) |
| GEDCOM export | Wiki: Import-Export (link from Card 5) |
| Import formats | Wiki: Import-Export (link from Card 5) |
| Bidirectional sync | Card 3: Key Concepts (brief + wiki link) |
| Split canvas wizard | Wiki: Advanced-Features (link from Card 5) |
| Common tasks | Card 4: Common Tasks |
| Templater | Card 5: Learn More (button) |
| Pro tips | Card 5: Learn More (collapsed) |

## Estimated Result

- **Before**: 19 cards, ~976 lines, overwhelming
- **After**: 5 cards, ~200 lines, focused

## Open Questions

1. Should we keep any detailed content inline, or fully defer to wiki?
2. Should collapsed sections remember their state across tab switches?
3. Should the wiki links open in-app (if possible) or external browser?
