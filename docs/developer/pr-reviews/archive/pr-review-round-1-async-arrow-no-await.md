# PR Review Round 1 - Async Arrow Function No Await

**Source:** [Obsidian PR Comment #3577414946](https://github.com/obsidianmd/obsidian-releases/pull/8689#issuecomment-3577414946)

**Priority:** Medium
**Total Issues:** 11
**Category:** Async arrow function has no 'await' expression.

## Issue Description

Arrow functions marked as `async` that don't contain any `await` expressions. This is either:
1. A mistake - the function was intended to await something
2. Unnecessary - the `async` keyword can be removed
3. For future use - but should be synchronous until actually needed

## Fix Strategy

For each async arrow function:
1. Check if there's a missing `await` that should be added
2. If no await is needed, remove the `async` keyword
3. If the function returns a Promise but doesn't await anything, consider if it needs to be async

## Issues Table

### main.ts (10 locations)

| # | Line | Description | Status |
|---|------|-------------|--------|
| 1 | 157 | [main.ts:157](../../../main.ts#L157) | ❌ |
| 2 | 211 | [main.ts:211](../../../main.ts#L211) | ❌ |
| 3 | 364 | [main.ts:364](../../../main.ts#L364) | ❌ |
| 4 | 379 | [main.ts:379](../../../main.ts#L379) | ❌ |
| 5 | 502 | [main.ts:502](../../../main.ts#L502) | ❌ |
| 6 | 516 | [main.ts:516](../../../main.ts#L516) | ❌ |
| 7 | 651 | [main.ts:651](../../../main.ts#L651) | ❌ |
| 8 | 669 | [main.ts:669](../../../main.ts#L669) | ❌ |
| 9 | 715 | [main.ts:715](../../../main.ts#L715) | ❌ |
| 10 | 733 | [main.ts:733](../../../main.ts#L733) | ❌ |

### src/ui/control-center.ts (1 location)

| # | Line | Description | Status |
|---|------|-------------|--------|
| 11 | 1683 | [control-center.ts:1683](../../../src/ui/control-center.ts#L1683) | ❌ |

## Progress

**Completed: 0/11 (0%)**
