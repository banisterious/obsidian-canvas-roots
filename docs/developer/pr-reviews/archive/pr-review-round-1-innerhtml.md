# PR Review Round 1 - innerHTML Usage

**Source:** [Obsidian PR Comment #3577414946](https://github.com/obsidianmd/obsidian-releases/pull/8689#issuecomment-3577414946)

**Priority:** Low (Security/Best Practice)
**Total Issues:** 9
**Category:** Do not write to DOM directly using innerHTML/outerHTML property.

## Issue Description

Direct DOM manipulation using `innerHTML` can be a security risk (XSS) and bypasses Obsidian's recommended DOM APIs. Use Obsidian's element creation methods instead.

## Fix Strategy

Replace `innerHTML` with proper DOM methods:
```typescript
// Before
element.innerHTML = '<div class="foo">text</div>';

// After
const div = element.createDiv({ cls: 'foo', text: 'text' });

// For SVG or complex HTML, use document fragment or sanitization
```

## Issues Table

| # | Line | File | Status |
|---|------|------|--------|
| 1 | 150-151 | [src/settings.ts](../../../src/settings.ts#L150-L151) | ❌ |
| 2 | 269-270 | [src/settings.ts](../../../src/settings.ts#L269-L270) | ❌ |
| 3 | 535 | [src/ui/control-center.ts](../../../src/ui/control-center.ts#L535) | ❌ |
| 4 | 540 | [src/ui/control-center.ts](../../../src/ui/control-center.ts#L540) | ❌ |
| 5 | 1763-1764 | [src/ui/control-center.ts](../../../src/ui/control-center.ts#L1763-L1764) | ❌ |
| 6 | 3333 | [src/ui/control-center.ts](../../../src/ui/control-center.ts#L3333) | ❌ |
| 7 | 4611-4612 | [src/ui/control-center.ts](../../../src/ui/control-center.ts#L4611-L4612) | ❌ |
| 8 | 4633-4634 | [src/ui/control-center.ts](../../../src/ui/control-center.ts#L4633-L4634) | ❌ |
| 9 | 383 | [src/ui/tree-preview.ts](../../../src/ui/tree-preview.ts#L383) | ❌ |

## Progress

**Completed: 0/9 (0%)**
