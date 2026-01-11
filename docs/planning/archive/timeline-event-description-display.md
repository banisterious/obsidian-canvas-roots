# Plan: Timeline Event Description Display (Issue #157)

- **Status:** Shipped (0.19.3, extended in 0.19.4)
- **GitHub Issue:** [#157](https://github.com/banisterious/obsidian-charted-roots/issues/157)

---

## Overview

For certain event types (Occupation, Residence, Military, Education), display the event description instead of the event title in person timelines. This provides more meaningful information at a glance.

## Motivation

When viewing a person's timeline, events like "Occupation of F MISTET" are not informative — the user wants to see what the occupation actually was (e.g., "Prêtre de Ligné"). The description field contains this meaningful data, but the timeline currently only displays the event title.

## Current Behavior

```
1850 — Occupation of F MISTET
1855 — Residence of F MISTET
```

## Proposed Behavior

```
1850 — Occupation: Prêtre de Ligné
1855 — Residence: Paris, France
```

- Format: `{EventType}: {description}`
- Still links to the event note file
- Falls back to current behavior (title) if no description exists

## Affected Event Types

| Event Type | Category | Example Description |
|------------|----------|---------------------|
| `occupation` | Life | Farmer, Priest, Blacksmith |
| `residence` | Life | Paris, France; 123 Main St |
| `military` | Life | Army, Navy, Regiment details |
| `education` | Life | Harvard University, Primary School |
| `marriage` | Family | Church wedding, Civil ceremony |
| `engagement` | Family | Wedding banns, Betrothal |

## Implementation

### Primary File: `src/dynamic-content/renderers/timeline-renderer.ts`

**Current state:**
- `TimelineEntry` interface already has `description?: string` field (line 21)
- `description` is already populated when building entries (line 148)
- Render logic uses only `entry.title` (lines 206-219)

**Changes needed:**

1. **Define descriptive event types:**
```typescript
const DESCRIPTION_DISPLAY_TYPES = ['occupation', 'residence', 'military', 'education', 'marriage', 'engagement'];
```

2. **Modify `renderTimelineList()` method:**
```typescript
// Determine display text
let displayText = entry.title;
if (DESCRIPTION_DISPLAY_TYPES.includes(entry.type) && entry.description) {
    // Capitalize event type for display
    const typeLabel = entry.type.charAt(0).toUpperCase() + entry.type.slice(1);
    displayText = `${typeLabel}: ${entry.description}`;
}

// Render with link
if (entry.eventFile) {
    await MarkdownRenderer.render(
        context.familyGraph['app'],
        `[[${entry.eventFile}|${displayText}]]`,
        titleSpan,
        context.file.path,
        component
    );
} else {
    titleSpan.textContent = displayText;
}
```

3. **Update `generateMarkdown()` method** (for freeze functionality):
```typescript
// Add title with wikilink if it's an event
let displayText = entry.title;
if (DESCRIPTION_DISPLAY_TYPES.includes(entry.type) && entry.description) {
    const typeLabel = entry.type.charAt(0).toUpperCase() + entry.type.slice(1);
    displayText = `${typeLabel}: ${entry.description}`;
}

if (entry.eventFile) {
    line += `[[${entry.eventFile}|${displayText}]]`;
} else {
    line += displayText;
}
```

4. **Update `copyTimelineToClipboard()` method** (same display logic for consistency)

### Secondary Files (optional, future)

- `src/reports/services/pdf-report-renderer.ts` — PDF timeline sections
- `src/events/ui/person-timeline.ts` — Person timeline panel (if different from dynamic block)

## Edge Cases

1. **No description:** Fall back to displaying title (current behavior)
2. **Empty description:** Treat as no description, show title
3. **Long descriptions:** CSS may need to handle overflow (existing styles should work)
4. **Custom event types:** Only apply to the four specified types; custom types use title

## Testing Checklist

- [x] Occupation event with description shows "Occupation: {description}"
- [x] Residence event with description shows "Residence: {description}"
- [x] Military event with description shows "Military: {description}"
- [x] Education event with description shows "Education: {description}"
- [x] Marriage event with description shows "Marriage: {description}"
- [x] Engagement event with description shows "Engagement: {description}"
- [x] Events without description still show title
- [x] Birth/Death events unaffected (still show "Born"/"Died")
- [x] Wikilink to event note still works
- [ ] Freeze to markdown produces correct output
- [ ] Copy to clipboard produces correct text

## Estimate

30-60 minutes implementation time. Very low risk — isolated change in one file.
