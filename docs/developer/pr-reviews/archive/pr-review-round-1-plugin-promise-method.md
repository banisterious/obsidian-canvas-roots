# PR Review Round 1 - Plugin Promise Method

**Source:** [Obsidian PR Comment #3577414946](https://github.com/obsidianmd/obsidian-releases/pull/8689#issuecomment-3577414946)

**Priority:** High
**Total Issues:** 1
**Category:** Promise-returning method provided where a void return was expected by extended/implemented type 'Plugin'.

## Issue Description

The `onunload` method in the Plugin class should return `void`, not a Promise. If the method is marked as `async` but doesn't actually need to await anything, it should be converted to a synchronous method.

## Fix Strategy

1. Check if the `onunload` method actually needs to be async
2. If it doesn't need `await`, remove the `async` keyword
3. If it does need async operations, handle them properly without returning a Promise from the method signature

## Issues Table

| # | Line | File | Method | Status |
|---|------|------|--------|--------|
| 1 | 880-887 | [main.ts](../../../main.ts#L880-L887) | `onunload` | ❌ |

## Progress

**Completed: 0/1 (0%)**

## Notes

This issue is related to "Async method 'onunload' has no 'await' expression" - both can be fixed by removing the `async` keyword from the method.
