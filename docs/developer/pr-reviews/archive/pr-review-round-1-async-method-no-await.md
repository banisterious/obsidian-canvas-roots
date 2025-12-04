# PR Review Round 1 - Async Method No Await

**Source:** [Obsidian PR Comment #3577414946](https://github.com/obsidianmd/obsidian-releases/pull/8689#issuecomment-3577414946)

**Priority:** Medium
**Total Issues:** 12
**Category:** Async method has no 'await' expression.

## Issue Description

Methods marked as `async` that don't contain any `await` expressions. The `async` keyword should either:
1. Be removed if no async operations are needed
2. Or the method should await something

## Fix Strategy

For each async method:
1. Check if there's a missing `await` that should be added
2. If no await is needed, remove the `async` keyword
3. Ensure the return type is updated if removing `async`

## Issues Table

| # | Line | File | Method | Status |
|---|------|------|--------|--------|
| 1 | 880 | [main.ts](../../../main.ts#L880) | `onunload` | ❌ |
| 2 | 47 | [src/core/bidirectional-linker.ts](../../../src/core/bidirectional-linker.ts#L47) | `initializeSnapshots` | ❌ |
| 3 | 74 | [src/core/canvas-finder.ts](../../../src/core/canvas-finder.ts#L74) | `nodeMatchesPerson` | ❌ |
| 4 | 684 | [src/core/family-graph.ts](../../../src/core/family-graph.ts#L684) | `extractPersonNode` | ❌ |
| 5 | 192 | [src/core/relationship-validator.ts](../../../src/core/relationship-validator.ts#L192) | `getAllPersonCrIds` | ❌ |
| 6 | 130 | [src/core/vault-stats.ts](../../../src/core/vault-stats.ts#L130) | `extractPersonData` | ❌ |
| 7 | 252 | [src/ui/control-center.ts](../../../src/ui/control-center.ts#L252) | `openWithPerson` | ❌ |
| 8 | 4710 | [src/ui/control-center.ts](../../../src/ui/control-center.ts#L4710) | `extractPersonInfoFromFile` | ❌ |
| 9 | 67 | [src/ui/folder-scan-modal.ts](../../../src/ui/folder-scan-modal.ts#L67) | `findPersonNotes` | ❌ |
| 10 | 181 | [src/ui/person-picker.ts](../../../src/ui/person-picker.ts#L181) | `extractPersonInfo` | ❌ |
| 11 | 34 | [src/ui/relationship-calculator-modal.ts](../../../src/ui/relationship-calculator-modal.ts#L34) | `onOpen` | ❌ |
| 12 | 131 | [src/ui/tree-preview.ts](../../../src/ui/tree-preview.ts#L131) | `renderPreview` | ❌ |

## Progress

**Completed: 0/12 (0%)**
