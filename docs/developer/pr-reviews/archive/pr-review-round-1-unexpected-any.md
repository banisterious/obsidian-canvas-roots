# PR Review Round 1 - Unexpected Any

**Source:** [Obsidian PR Comment #3577414946](https://github.com/obsidianmd/obsidian-releases/pull/8689#issuecomment-3577414946)

**Priority:** Medium
**Total Issues:** 2
**Category:** Unexpected any. Specify a different type.

## Issue Description

The `any` type bypasses TypeScript's type checking and should be replaced with a more specific type. This improves code safety and IDE assistance.

## Fix Strategy

For each `any` usage:
1. Determine the actual expected type
2. Replace `any` with the specific type
3. If the type is truly unknown, use `unknown` instead and add type guards

## Issues Table

| # | Line | File | Status |
|---|------|------|--------|
| 1 | 1447 | [main.ts](../../../main.ts#L1447) | ❌ |
| 2 | 79 | [src/core/person-note-writer.ts](../../../src/core/person-note-writer.ts#L79) | ❌ |

## Progress

**Completed: 0/2 (0%)**
