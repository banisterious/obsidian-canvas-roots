# PR Review Round 1 - Promise Returned in Void Context

**Source:** [Obsidian PR Comment #3577414946](https://github.com/obsidianmd/obsidian-releases/pull/8689#issuecomment-3577414946)

**Priority:** Medium
**Total Issues:** 29
**Category:** Promise returned in function argument where a void return was expected.

## Issue Description

These locations return Promises in contexts that expect void returns (like event handlers, callbacks). This can lead to unhandled promise rejections.

## Fix Strategy

For each occurrence:
1. Wrap the async operation in a `.catch()` handler
2. Or use an IIFE with proper error handling
3. Or use `void` operator if the error can be safely ignored

Example fix:
```typescript
// Before (problematic)
button.onClick(() => this.doAsyncThing());

// After (option 1 - void operator)
button.onClick(() => void this.doAsyncThing());

// After (option 2 - explicit catch)
button.onClick(() => {
    this.doAsyncThing().catch(console.error);
});
```

## Issues Table

### main.ts (9 locations)

| # | Line | Description | Status |
|---|------|-------------|--------|
| 1 | 304-316 | [main.ts:304-316](../../../main.ts#L304-L316) | ❌ |
| 2 | 326-329 | [main.ts:326-329](../../../main.ts#L326-L329) | ❌ |
| 3 | 339-342 | [main.ts:339-342](../../../main.ts#L339-L342) | ❌ |
| 4 | 446-456 | [main.ts:446-456](../../../main.ts#L446-L456) | ❌ |
| 5 | 466-469 | [main.ts:466-469](../../../main.ts#L466-L469) | ❌ |
| 6 | 479-482 | [main.ts:479-482](../../../main.ts#L479-L482) | ❌ |
| 7 | 819-827 | [main.ts:819-827](../../../main.ts#L819-L827) | ❌ |
| 8 | 986-1005 | [main.ts:986-1005](../../../main.ts#L986-L1005) | ❌ |
| 9 | 1074-1093 | [main.ts:1074-1093](../../../main.ts#L1074-L1093) | ❌ |

### src/ui/canvas-style-modal.ts (2 locations)

| # | Line | Description | Status |
|---|------|-------------|--------|
| 10 | 196-206 | [canvas-style-modal.ts:196-206](../../../src/ui/canvas-style-modal.ts#L196-L206) | ❌ |
| 11 | 211-213 | [canvas-style-modal.ts:211-213](../../../src/ui/canvas-style-modal.ts#L211-L213) | ❌ |

### src/ui/control-center.ts (12 locations)

| # | Line | Description | Status |
|---|------|-------------|--------|
| 12 | 593-599 | [control-center.ts:593-599](../../../src/ui/control-center.ts#L593-L599) | ❌ |
| 13 | 607-612 | [control-center.ts:607-612](../../../src/ui/control-center.ts#L607-L612) | ❌ |
| 14 | 755-760 | [control-center.ts:755-760](../../../src/ui/control-center.ts#L755-L760) | ❌ |
| 15 | 771-781 | [control-center.ts:771-781](../../../src/ui/control-center.ts#L771-L781) | ❌ |
| 16 | 830-835 | [control-center.ts:830-835](../../../src/ui/control-center.ts#L830-L835) | ❌ |
| 17 | 1683-1686 | [control-center.ts:1683-1686](../../../src/ui/control-center.ts#L1683-L1686) | ❌ |
| 18 | 1723-1732 | [control-center.ts:1723-1732](../../../src/ui/control-center.ts#L1723-L1732) | ❌ |
| 19 | 2496-2504 | [control-center.ts:2496-2504](../../../src/ui/control-center.ts#L2496-L2504) | ❌ |
| 20 | 2517-2570 | [control-center.ts:2517-2570](../../../src/ui/control-center.ts#L2517-L2570) | ❌ |
| 21 | 2785-2823 | [control-center.ts:2785-2823](../../../src/ui/control-center.ts#L2785-L2823) | ❌ |
| 22 | 3343-3347 | [control-center.ts:3343-3347](../../../src/ui/control-center.ts#L3343-L3347) | ❌ |
| 23 | 3758-3764 | [control-center.ts:3758-3764](../../../src/ui/control-center.ts#L3758-L3764) | ❌ |
| 24 | 3842-3848 | [control-center.ts:3842-3848](../../../src/ui/control-center.ts#L3842-L3848) | ❌ |
| 25 | 4646-4648 | [control-center.ts:4646-4648](../../../src/ui/control-center.ts#L4646-L4648) | ❌ |

### Other files (4 locations)

| # | Line | File | Status |
|---|------|------|--------|
| 26 | 139-143 | [find-on-canvas-modal.ts](../../../src/ui/find-on-canvas-modal.ts#L139-L143) | ❌ |
| 27 | 203-207 | [folder-scan-modal.ts](../../../src/ui/folder-scan-modal.ts#L203-L207) | ❌ |
| 28 | 103-108 | [regenerate-options-modal.ts](../../../src/ui/regenerate-options-modal.ts#L103-L108) | ❌ |
| 29 | 93 | [relationship-calculator-modal.ts](../../../src/ui/relationship-calculator-modal.ts#L93) | ❌ |

## Progress

**Completed: 0/29 (0%)**
