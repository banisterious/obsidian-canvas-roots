# PR Review Round 1 - Floating Promises

**Source:** [Obsidian PR Comment #3577414946](https://github.com/obsidianmd/obsidian-releases/pull/8689#issuecomment-3577414946)

**Priority:** High
**Total Issues:** 13
**Category:** Promises must be awaited, end with a call to .catch, end with a call to .then with a rejection handler or be explicitly marked as ignored with the `void` operator.

## Issue Description

These locations have Promise-returning expressions that are not properly handled. Unhandled promises can lead to silent failures and untracked errors. Each promise must be either:
1. Awaited with `await`
2. Caught with `.catch()`
3. Handled with `.then(onSuccess, onError)`
4. Explicitly ignored with `void` operator

## Fix Strategy

For each floating promise, choose the appropriate handler:
- Use `await` in async contexts
- Use `.catch()` or `.then(onSuccess, onError)` when await is not appropriate
- Use `void` operator only when the promise failure is truly inconsequential

## Issues Table

### main.ts (4 locations)

| # | Line | Description | Status |
|---|------|-------------|--------|
| 1 | 38 | [main.ts:38](../../../main.ts#L38) | ❌ |
| 2 | 62 | [main.ts:62](../../../main.ts#L62) | ❌ |
| 3 | 97 | [main.ts:97](../../../main.ts#L97) | ❌ |
| 4 | 106 | [main.ts:106](../../../main.ts#L106) | ❌ |

### src/ui/control-center.ts (8 locations)

| # | Line | Description | Status |
|---|------|-------------|--------|
| 5 | 204 | [control-center.ts:204](../../../src/ui/control-center.ts#L204) | ❌ |
| 6 | 219 | [control-center.ts:219](../../../src/ui/control-center.ts#L219) | ❌ |
| 7 | 222 | [control-center.ts:222](../../../src/ui/control-center.ts#L222) | ❌ |
| 8 | 2060-2070 | [control-center.ts:2060-2070](../../../src/ui/control-center.ts#L2060-L2070) | ❌ |
| 9 | 2079-2089 | [control-center.ts:2079-2089](../../../src/ui/control-center.ts#L2079-L2089) | ❌ |
| 10 | 3568 | [control-center.ts:3568](../../../src/ui/control-center.ts#L3568) | ❌ |
| 11 | 3956 | [control-center.ts:3956](../../../src/ui/control-center.ts#L3956) | ❌ |
| 12 | 4626-4644 | [control-center.ts:4626-4644](../../../src/ui/control-center.ts#L4626-L4644) | ❌ |

### src/ui/relationship-calculator-modal.ts (1 location)

| # | Line | Description | Status |
|---|------|-------------|--------|
| 13 | 386 | [relationship-calculator-modal.ts:386](../../../src/ui/relationship-calculator-modal.ts#L386) | ❌ |

## Progress

**Completed: 0/13 (0%)**
