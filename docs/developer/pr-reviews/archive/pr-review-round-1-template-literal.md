# PR Review Round 1 - Invalid Template Literal Expression

**Source:** [Obsidian PR Comment #3577414946](https://github.com/obsidianmd/obsidian-releases/pull/8689#issuecomment-3577414946)

**Priority:** Low
**Total Issues:** 1
**Category:** Invalid type "string[] | undefined" of template literal expression.

## Issue Description

Template literal expressions require types that can be coerced to strings. Using `string[] | undefined` directly in a template literal can produce unexpected output like "[object Object]" or "undefined".

## Fix Strategy

Handle the array/undefined case explicitly:
```typescript
// Before
const msg = `Values: ${arrayOrUndefined}`;

// After
const msg = `Values: ${arrayOrUndefined?.join(', ') ?? 'none'}`;
```

## Issues Table

| # | Line | File | Status |
|---|------|------|--------|
| 1 | 103 | [src/core/person-note-writer.ts](../../../src/core/person-note-writer.ts#L103) | ❌ |

## Progress

**Completed: 0/1 (0%)**
