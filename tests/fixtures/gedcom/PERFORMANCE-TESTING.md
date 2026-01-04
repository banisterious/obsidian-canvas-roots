# Performance Testing Guide

This guide documents how to conduct performance testing for Canvas Roots, particularly for the Family Chart feature with large datasets.

## Quick Start

```bash
# Generate a test file with ~1500 people
node generate-loadtest.js 1500

# Generate larger test files
node generate-loadtest.js 3000 loadtest-3000.ged
node generate-loadtest.js 5000 loadtest-5000.ged
```

## Test File Sizes

| File | People | Use Case |
|------|--------|----------|
| tiny.ged | ~10 | Quick smoke tests |
| small.ged | ~50 | Basic functionality |
| medium.ged | ~150 | Normal usage |
| large.ged | ~300 | Moderate stress |
| xlarge.ged | ~600 | Current stress test |
| loadtest-*.ged | Custom | Performance benchmarking |

## Performance Metrics

When testing, capture these metrics from the browser console:

### Family Chart Timing

The Family Chart logs detailed timing information:

```
[Canvas Roots] Chart init timing: {
  dataLoad: "12.5ms",      // Time to load person data
  chartCreate: "45.2ms",   // Time to create chart instance
  initialRender: "311.5ms", // Time for initial render
  fit: "322.0ms",          // Time for fit operation
  total: "691.2ms"         // Total initialization time
}
```

### Key Thresholds

| Metric | Good | Acceptable | Needs Attention |
|--------|------|------------|-----------------|
| Data load | < 50ms | < 100ms | > 200ms |
| Initial render | < 500ms | < 1000ms | > 2000ms |
| Total init | < 1000ms | < 2000ms | > 3000ms |

## Running Performance Tests

### 1. Prepare Test Environment

1. Create a fresh test vault
2. Import a GEDCOM test file using the plugin's import wizard
3. Open browser developer tools (F12 → Console)
4. Filter console by "Canvas Roots" to focus on relevant logs

### 2. Test Family Chart Performance

```
Test: Family Chart Initial Load
Dataset: [size] people
Steps:
1. Close any open Family Chart views
2. Open a person note
3. Run "Open family chart" command
4. Record timing from console

Results:
- Data load: ___ms
- Initial render: ___ms
- Fit operation: ___ms
- Total: ___ms
```

### 3. Test Chart Navigation

```
Test: Family Chart Navigation
Dataset: [size] people
Steps:
1. With chart open, click on different family members
2. Record any lag or delays
3. Note console errors if any

Results:
- Navigation responsiveness: [smooth/acceptable/laggy]
- Console errors: [yes/no]
```

### 4. Test Live Updates

```
Test: Live Note Updates
Dataset: [size] people
Steps:
1. Open Family Chart for a person
2. Edit that person's note (change a property)
3. Observe chart update timing

Results:
- Update delay: ___ms
- Chart correctly updated: [yes/no]
```

## Benchmark Recording Template

Use this template to record benchmark results:

```markdown
## Performance Benchmark - [Date]

### Environment
- Plugin version: x.x.x
- Obsidian version: x.x.x
- OS: [Windows/Mac/Linux]
- Hardware: [CPU, RAM]

### Results

| Dataset | People | Data Load | Render | Fit | Total |
|---------|--------|-----------|--------|-----|-------|
| medium | 150 | ms | ms | ms | ms |
| large | 300 | ms | ms | ms | ms |
| xlarge | 600 | ms | ms | ms | ms |
| loadtest | 1500 | ms | ms | ms | ms |
| loadtest | 3000 | ms | ms | ms | ms |

### Observations
-
-

### Recommendations
-
-
```

## Known Performance Characteristics

### Current Bottlenecks

1. **Chart Rendering** (~300-500ms for 600 people)
   - The family-chart library's initial render is the main bottleneck
   - This is in the third-party library, not Canvas Roots code
   - Data loading itself is very fast (~10-15ms)

2. **Fit Operation** (~300-500ms for 600 people)
   - The "fit to view" calculation scales with chart complexity
   - Also in the third-party library

3. **Metadata Cache** (variable)
   - Obsidian's metadata cache is typically fast
   - Large vaults (1000s of files) may see initial delays

### Scaling Expectations

Based on current benchmarks with 600 people:
- Data loading scales linearly: ~20μs per person
- Rendering scales non-linearly: may increase significantly past 1000 people
- Memory usage: roughly proportional to person count

## Generating Custom Test Data

The `generate-loadtest.js` script creates realistic family structures:

```bash
# Basic usage
node generate-loadtest.js <target-people> [output-file]

# Examples
node generate-loadtest.js 1500                    # Creates loadtest-1500.ged
node generate-loadtest.js 2500 stress-test.ged   # Custom filename
```

### Generated Data Characteristics

- 7 generations of families
- 2-6 children per family (random)
- Realistic birth/death dates
- Proper parent-child and spouse relationships
- Unique IDs for all individuals

## Interpreting Results

### Good Performance
- Total chart initialization under 1 second
- Smooth navigation between family members
- Live updates within 500ms

### Performance Concerns
- Initialization over 2 seconds
- Noticeable lag when clicking family members
- Console showing repeated errors

### When to Optimize
- Users report lag with typical dataset sizes (< 500 people)
- Initialization exceeds 3 seconds consistently
- Memory usage causes browser/Obsidian slowdowns

## Reporting Performance Issues

When reporting performance issues, include:

1. Dataset size (number of people)
2. Console timing output
3. Hardware specifications
4. Obsidian and plugin versions
5. Any console errors
6. Steps to reproduce
