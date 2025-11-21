# GEDCOM Test Datasets

> **⚠️ IMPORTANT: All individuals in these test files are entirely fictional.**
> Names, dates, locations, and relationships are programmatically generated or manually invented for testing purposes only. Any resemblance to real persons, living or deceased, is purely coincidental.

This directory contains progressively larger GEDCOM test files for stress-testing the Canvas Roots layout engine at various scales.

## Test Files Overview

| File | People | Families | Generations | File Size | Purpose |
|------|--------|----------|-------------|-----------|---------|
| `gedcom-sample-tiny.ged` | 11 | 4 | 4 | 2.6 KB | Baseline validation |
| `gedcom-sample-small.ged` | 27 | 14 | 4 | 5.3 KB | Basic scale test |
| `gedcom-sample-medium.ged` | 60 | ~30 | 5 | 12 KB | Medium complexity |
| `gedcom-sample-large.ged` | 163 | ~80 | 6 | 31 KB | Large family tree |
| `gedcom-sample-xlarge.ged` | 599 | 179 | 7 | 113 KB | Extreme stress test |

## Recommended Testing Sequence

### 1. Tiny (11 people) - BASELINE ✓
**Status:** Already validated in previous session

**Expected Results:**
- Zero overlaps
- All 11 people visible
- Proper spacing with 1.5x multiplier (600px horizontal)
- Siblings-in-law positioned correctly

**Use this to verify:** Basic functionality still works

---

### 2. Small (27 people) - BASIC SCALE
**What to test:**
- Canvas size remains manageable
- No performance issues
- Multiple sibling relationships handled correctly
- Layout remains readable

**Expected challenges:**
- More horizontal spreading with multiple siblings
- More spouse relationships to position

**Success criteria:**
- All 27 people visible
- Zero overlaps
- Canvas can be viewed without excessive zooming
- Generation levels clearly visible

---

### 3. Medium (60 people) - MEDIUM COMPLEXITY
**What to test:**
- Performance with 5 generations
- Multiple marriages handling (3 people have second marriages)
- Larger families (several with 3+ children)
- International names and locations display correctly

**Expected challenges:**
- Canvas width may become significant
- More complex spouse positioning
- Potential for performance issues during layout calculation

**Success criteria:**
- All 60 people visible
- Zero overlaps
- Layout completes in reasonable time (< 5 seconds)
- Multiple marriages don't cause visual confusion
- Canvas remains navigable

**Red flags to watch for:**
- Overlapping nodes
- Excessive canvas width (> 10,000px)
- Layout calculation time > 10 seconds
- Browser performance issues

---

### 4. Large (163 people) - STRESS TEST
**What to test:**
- 6 generations with complex relationships
- Multiple marriages (6+ people with 2-3 spouses)
- Large families
- Performance at realistic genealogy scale

**Expected challenges:**
- Very large canvas dimensions
- Significant horizontal spreading
- Memory usage
- Rendering performance
- Potential algorithmic limits of family-chart library

**Success criteria:**
- All 163 people visible
- Zero overlaps
- Layout completes in reasonable time (< 30 seconds)
- Canvas remains usable (may require significant zooming)
- No browser crashes or memory issues

**Red flags to watch for:**
- Overlapping nodes at complex relationship intersections
- Excessive canvas dimensions (> 20,000px)
- Layout calculation timeout
- Browser performance degradation
- Missing people due to algorithmic edge cases

**This is the critical test** - if the layout engine handles 163 people well, it can likely handle most real-world genealogies.

---

## Testing Methodology

### Import Process
1. Open Obsidian with Canvas Roots plugin enabled
2. Use Control Center → Data Entry tab (or GEDCOM import command if available)
3. Select GEDCOM file
4. Import to a test collection (e.g., "test-tiny", "test-small", etc.)
5. Note import time and any errors

### Tree Generation
1. Select root person (usually first person in file)
2. Generate full tree (no depth limits)
3. Note generation time
4. Export to canvas

### Measurements to Record

**Performance Metrics:**
- Import time (seconds)
- Layout calculation time (seconds)
- Canvas render time (seconds)
- Total memory usage (check browser task manager)

**Layout Metrics:**
- Canvas width (pixels)
- Canvas height (pixels)
- Number of overlapping nodes (should be 0)
- Missing people (should be 0)
- Visual quality assessment (1-5 scale)

**Issues to Document:**
- Any overlapping nodes (screenshot + IDs)
- Missing people (IDs)
- Performance problems
- Visual artifacts
- Edge case failures

---

## Known Dataset Characteristics

### Tiny (11 people)
- **Structure:** Simple 4-generation family
- **Relationships:** Basic parent-child, one spouse per person
- **Date range:** 1920-2008
- **Complexity:** Low

### Small (27 people)
- **Structure:** 4 generations with multiple siblings
- **Relationships:** Some families with 3 children
- **Date range:** 1930-2016
- **Complexity:** Low-Medium
- **Special features:** Diverse surnames (Anderson, Martinez, Chen, Thompson, Lee)

### Medium (60 people)
- **Structure:** 5 generations
- **Relationships:** 3 people with multiple marriages, families with 3+ children
- **Date range:** 1905-2011
- **Complexity:** Medium
- **Special features:** International locations (Germany, Italy, Japan, Ireland, Mexico, etc.)

### Large (163 people)
- **Structure:** 6 generations
- **Relationships:** 6+ people with multiple marriages, one person with 3 marriages
- **Date range:** 1892-2012
- **Complexity:** High
- **Special features:**
  - Very diverse international names and locations
  - Large families (one family has 7 children)
  - Complex relationship patterns
  - Realistic genealogy scale

### Extra-Large (599 people)
- **Structure:** 7 generations
- **Relationships:** 179 families, 10 people with multiple marriages, many large families
- **Date range:** 1880-2024
- **Complexity:** Extreme
- **Special features:**
  - Generated programmatically for consistency
  - Wide variety of surnames (90+ different surnames)
  - International locations across all continents
  - Multiple families with 5-6 children
  - Stress tests absolute limits of layout engine
- **Note:** This is intentionally oversized to find breaking points

---

## Results Template

Create a file `TESTING-RESULTS.md` in this directory with:

```markdown
# Scale Testing Results

**Date:** YYYY-MM-DD
**Plugin Version:** X.X.X
**Obsidian Version:** X.X.X
**Browser/Platform:** Chrome/Electron on Windows/Mac/Linux

## Tiny (11 people)
- Import time: X.X sec
- Layout time: X.X sec
- Canvas dimensions: XXX x XXX px
- Overlaps: 0
- Missing people: 0
- Issues: None
- Status: ✅ PASS

## Small (27 people)
- Import time: X.X sec
- Layout time: X.X sec
- Canvas dimensions: XXX x XXX px
- Overlaps: X
- Missing people: X
- Issues: [describe any issues]
- Status: ✅ PASS / ⚠️ ISSUES / ❌ FAIL

## Medium (60 people)
- [same structure]

## Large (163 people)
- [same structure]

## Conclusions
- Maximum recommended tree size: XXX people
- Performance bottlenecks: [describe]
- Layout quality: [excellent/good/acceptable/poor]
- Recommended improvements: [list]
```

---

### 5. Extra-Large (599 people) - EXTREME STRESS TEST
**What to test:**
- 7 generations with very complex relationships
- 179 families with interconnections
- 10 people with multiple marriages
- Performance at extreme scale
- Absolute limits of family-chart library and Canvas

**Expected challenges:**
- Massive canvas dimensions (potentially 30,000+ pixels)
- Very long layout calculation time
- Significant memory usage
- Potential browser performance issues
- May hit algorithmic or technical limits

**Success criteria:**
- All 599 people visible
- Zero overlaps
- Layout completes (even if it takes 1-2 minutes)
- Canvas remains usable (even if heavily zoomed)
- No crashes or out-of-memory errors

**Red flags to watch for:**
- Browser crashes or freezes
- Layout calculation timeout/failure
- Out of memory errors
- Canvas becomes completely unusable
- Obsidian becomes unstable

**This is an EXTREME test** - if your layout engine handles 599 people, it can handle virtually anything. However, this may exceed practical limits, and that's valuable information too.

**Important:** If this test fails, that doesn't necessarily mean the plugin is broken - it may simply mean there are practical limits that should be documented (e.g., "recommended maximum: 200 people").

---

## Future Test Datasets

If needed based on initial results, consider creating:

### Edge Case Tests
- **Highly unbalanced tree:** One branch with many generations, another with few
- **Wide tree:** One person with 10+ children
- **Multiple disconnected trees:** Test collection with 2-3 separate family trees
- **Circular relationships:** Step-families creating relationship cycles

---

## Notes

- All GEDCOM files follow GEDCOM 5.5.1 standard
- All files use UTF-8 encoding
- Dates follow standard GEDCOM date format (DD MMM YYYY)
- Files were generated 2025-11-20 for Canvas Roots plugin testing
- Focus is on realistic family structures, not random graph generation
