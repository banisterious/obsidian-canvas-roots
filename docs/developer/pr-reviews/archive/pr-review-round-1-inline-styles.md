# PR Review Round 1 - Inline Styles

**Source:** [Obsidian PR Comment #3577414946](https://github.com/obsidianmd/obsidian-releases/pull/8689#issuecomment-3577414946)

**Priority:** Low (Maintainability)
**Total Issues:** 43
**Category:** Avoid setting styles directly via `element.style.*`. Use CSS classes for better theming and maintainability.

## Issue Description

Direct style manipulation via `element.style.property` should be avoided in favor of CSS classes. This improves:
- Theming support
- Maintainability
- Consistency with Obsidian's styling approach

## Fix Strategy

1. Create CSS classes in `styles.css` for the required styles
2. Replace `element.style.property = value` with `element.addClass('class-name')`
3. Use BEM naming convention with `cr-` prefix as per coding standards

Example:
```typescript
// Before
element.style.display = 'flex';
element.style.gap = '10px';

// After (in styles.css)
.cr-flex-container {
    display: flex;
    gap: 10px;
}

// After (in TypeScript)
element.addClass('cr-flex-container');
```

## Issues by Style Property

### display (20 occurrences)

| # | Line | File | Status |
|---|------|------|--------|
| 1 | 911 | [main.ts](../../../main.ts#L911) | ❌ |
| 2 | 977 | [main.ts](../../../main.ts#L977) | ❌ |
| 3 | 1065 | [main.ts](../../../main.ts#L1065) | ❌ |
| 4 | 1139 | [src/ui/control-center.ts](../../../src/ui/control-center.ts#L1139) | ❌ |
| 5 | 2437 | [src/ui/control-center.ts](../../../src/ui/control-center.ts#L2437) | ❌ |
| 6 | 2458 | [src/ui/control-center.ts](../../../src/ui/control-center.ts#L2458) | ❌ |
| 7 | 2500 | [src/ui/control-center.ts](../../../src/ui/control-center.ts#L2500) | ❌ |
| 8 | 2510 | [src/ui/control-center.ts](../../../src/ui/control-center.ts#L2510) | ❌ |
| 9 | 3292 | [src/ui/control-center.ts](../../../src/ui/control-center.ts#L3292) | ❌ |
| 10 | 3293 | [src/ui/control-center.ts](../../../src/ui/control-center.ts#L3293) | ❌ |
| 11 | 3344 | [src/ui/control-center.ts](../../../src/ui/control-center.ts#L3344) | ❌ |
| 12 | 3345 | [src/ui/control-center.ts](../../../src/ui/control-center.ts#L3345) | ❌ |
| 13 | 3354 | [src/ui/control-center.ts](../../../src/ui/control-center.ts#L3354) | ❌ |
| 14 | 3355 | [src/ui/control-center.ts](../../../src/ui/control-center.ts#L3355) | ❌ |
| 15 | 3372 | [src/ui/control-center.ts](../../../src/ui/control-center.ts#L3372) | ❌ |
| 16 | 3373 | [src/ui/control-center.ts](../../../src/ui/control-center.ts#L3373) | ❌ |
| 17 | 3752 | [src/ui/control-center.ts](../../../src/ui/control-center.ts#L3752) | ❌ |
| 18 | 85 | [src/ui/tree-preview.ts](../../../src/ui/tree-preview.ts#L85) | ❌ |
| 19 | 384 | [src/ui/tree-preview.ts](../../../src/ui/tree-preview.ts#L384) | ❌ |
| 20 | 393 | [src/ui/tree-preview.ts](../../../src/ui/tree-preview.ts#L393) | ❌ |

### marginTop (7 occurrences)

| # | Line | File | Status |
|---|------|------|--------|
| 1 | 914 | [main.ts](../../../main.ts#L914) | ❌ |
| 2 | 966 | [main.ts](../../../main.ts#L966) | ❌ |
| 3 | 972 | [main.ts](../../../main.ts#L972) | ❌ |
| 4 | 980 | [main.ts](../../../main.ts#L980) | ❌ |
| 5 | 1054 | [main.ts](../../../main.ts#L1054) | ❌ |
| 6 | 1060 | [main.ts](../../../main.ts#L1060) | ❌ |
| 7 | 1068 | [main.ts](../../../main.ts#L1068) | ❌ |

### cursor (4 occurrences)

| # | Line | File | Status |
|---|------|------|--------|
| 1 | 56 | [src/ui/tree-preview.ts](../../../src/ui/tree-preview.ts#L56) | ❌ |
| 2 | 68 | [src/ui/tree-preview.ts](../../../src/ui/tree-preview.ts#L68) | ❌ |
| 3 | 73 | [src/ui/tree-preview.ts](../../../src/ui/tree-preview.ts#L73) | ❌ |
| 4 | 76 | [src/ui/tree-preview.ts](../../../src/ui/tree-preview.ts#L76) | ❌ |

### gap (3 occurrences)

| # | Line | File | Status |
|---|------|------|--------|
| 1 | 912 | [main.ts](../../../main.ts#L912) | ❌ |
| 2 | 978 | [main.ts](../../../main.ts#L978) | ❌ |
| 3 | 1066 | [main.ts](../../../main.ts#L1066) | ❌ |

### justifyContent (3 occurrences)

| # | Line | File | Status |
|---|------|------|--------|
| 1 | 913 | [main.ts](../../../main.ts#L913) | ❌ |
| 2 | 979 | [main.ts](../../../main.ts#L979) | ❌ |
| 3 | 1067 | [main.ts](../../../main.ts#L1067) | ❌ |

### width (2 occurrences)

| # | Line | File | Status |
|---|------|------|--------|
| 1 | 965 | [main.ts](../../../main.ts#L965) | ❌ |
| 2 | 1053 | [main.ts](../../../main.ts#L1053) | ❌ |

### fontSize (2 occurrences)

| # | Line | File | Status |
|---|------|------|--------|
| 1 | 973 | [main.ts](../../../main.ts#L973) | ❌ |
| 2 | 1061 | [main.ts](../../../main.ts#L1061) | ❌ |

### color (2 occurrences)

| # | Line | File | Status |
|---|------|------|--------|
| 1 | 974 | [main.ts](../../../main.ts#L974) | ❌ |
| 2 | 1062 | [main.ts](../../../main.ts#L1062) | ❌ |

## Progress

**Completed: 0/43 (0%)**
