# PR Review Round 1 - Lexical Declaration in Case Block

**Source:** [Obsidian PR Comment #3577414946](https://github.com/obsidianmd/obsidian-releases/pull/8689#issuecomment-3577414946)

**Priority:** Low (Code Quality)
**Total Issues:** 2
**Category:** Unexpected lexical declaration in case block.

## Issue Description

Using `let` or `const` declarations in `case` blocks without braces can lead to unexpected behavior because the variable is hoisted to the switch block scope.

## Fix Strategy

Wrap case block contents in braces to create a proper block scope:
```typescript
// Before
switch (value) {
    case 'a':
        const x = 1;  // problematic
        break;
}

// After
switch (value) {
    case 'a': {
        const x = 1;  // properly scoped
        break;
    }
}
```

## Issues Table

| # | Line | File | Status |
|---|------|------|--------|
| 1 | 344 | [src/core/relationship-calculator.ts](../../../src/core/relationship-calculator.ts#L344) | ❌ |
| 2 | 359 | [src/core/relationship-calculator.ts](../../../src/core/relationship-calculator.ts#L359) | ❌ |

## Progress

**Completed: 0/2 (0%)**
