# MyHeritage GEDCOM Import Compatibility

**GitHub Issue:** [#144](https://github.com/banisterious/obsidian-charted-roots/issues/144)
**Status:** ✅ Complete (v0.19.1)
**Priority:** Medium
**Labels:** `accepted`, `enhancement`, `gedcom`
**Updated:** 2026-01-11

## Implementation Status

| Phase | Status | Version | Description |
|-------|--------|---------|-------------|
| Phase 1 | ✅ Complete | v0.18.28-29 | BOM removal, double-encoded entities, `<br>` → space |
| Phase 2 | ✅ Complete | v0.19.1+ | Tab-prefixed and unprefixed continuation lines, whitespace-only line fix |

## Problem Summary

MyHeritage GEDCOM exports contain formatting issues that prevent non-technical users from importing without manual cleanup:

1. **UTF-8 BOM (Byte Order Mark)** - Files begin with `ef bb bf` bytes
2. **Malformed CONC fields** - Source citations contain:
   - Double-encoded HTML entities (`&amp;lt;br&amp;gt;` instead of `<br>`)
   - Line breaks that split HTML entities across CONC continuation lines
   - Embedded newlines violating GEDCOM spec

### Example Problem

```gedcom
4 CONC , Pennsylvania, USA&amp;lt;br&amp;gt;Age: 22&amp;lt;br&amp;gt;...Race: White&am
4 CONC ;lt;br&amp;gt;Mother: Mary Smith&amp;lt;br&amp;gt;...
```

Notice the HTML entity split across lines: `&am` (end of line 1) + `;lt;br` (start of line 2)

### User Impact

From @wilbry in [Discussion #142](https://github.com/banisterious/obsidian-charted-roots/discussions/142#discussioncomment-15425345):
> "The gedcom [MyHeritage] exported had some issue with multiline CONC fields... I had to do some cleanup to get it into canvas roots. It wasn't an issue for me because I am pretty handy with modifying files easily, but it would be a big issue for someone less technical."

---

## Proposed Solution

Add **opt-in** preprocessing to GEDCOM importer to automatically fix MyHeritage-specific issues before parsing.

### Architecture Decision: Where to Preprocess

**Option A: Separate preprocessing step (RECOMMENDED)**
- Create cleaned temp file before parsing
- Preserves original uploaded file
- Easy to log changes and debug
- Can be reused for other vendor-specific fixes

**Option B: Inline during parsing**
- Fix issues as parser encounters them
- More memory-efficient
- Harder to report what was fixed
- Mixed concerns (parsing + fixing)

**Decision: Use Option A** - Separate preprocessing maintains clean separation of concerns and enables transparent reporting.

---

## Implementation Plan

### Phase 1: Core Preprocessing (MVP)

#### 1.1 Settings

Add new setting in GEDCOM import section:

```typescript
// settings.ts
export interface CanvasRootsSettings {
	// ... existing settings
	gedcomCompatibilityMode: 'auto' | 'myheritage' | 'none';
}

// Default: 'auto' (auto-detect MyHeritage and apply fixes)
```

**Setting Options:**
- `auto` - Detect MyHeritage files and apply fixes automatically (default)
- `myheritage` - Always apply MyHeritage fixes
- `none` - No preprocessing (current behavior)

#### 1.2 Detection Logic

Auto-detect MyHeritage files by checking for:
1. UTF-8 BOM at file start (`ef bb bf`)
2. `SOUR` tag with value `MYHERITAGE` (uppercase in header)
3. Presence of double-encoded entities in first 50KB

```typescript
// gedcom-preprocessor.ts
interface PreprocessorDetection {
	hasUtf8Bom: boolean;
	isMyHeritage: boolean;
	hasDoubleEncodedEntities: boolean;
	shouldPreprocess: boolean;
}

function detectMyHeritage(content: string): PreprocessorDetection {
	// Check for UTF-8 BOM
	const hasUtf8Bom = content.charCodeAt(0) === 0xFEFF ||
		(content.charCodeAt(0) === 0xEF &&
		 content.charCodeAt(1) === 0xBB &&
		 content.charCodeAt(2) === 0xBF);

	// Check for MyHeritage source tag (uppercase "MYHERITAGE" per real samples)
	const isMyHeritage = /1\s+SOUR\s+MYHERITAGE/i.test(content.substring(0, 2000));

	// Check for double-encoded entities (sample first 50KB)
	// Includes &amp;nbsp; which appears in MyHeritage exports
	const sample = content.substring(0, 50000);
	const hasDoubleEncodedEntities = /&amp;(?:lt|gt|amp|quot|nbsp);/i.test(sample);

	return {
		hasUtf8Bom,
		isMyHeritage,
		hasDoubleEncodedEntities,
		shouldPreprocess: hasUtf8Bom || (isMyHeritage && hasDoubleEncodedEntities)
	};
}
```

#### 1.3 Preprocessing Functions

**Fix 1: Strip UTF-8 BOM**

```typescript
function stripUtf8Bom(content: string): { content: string; fixed: boolean } {
	// Handle BOM as Unicode character U+FEFF
	if (content.charCodeAt(0) === 0xFEFF) {
		return { content: content.substring(1), fixed: true };
	}

	// Handle BOM as raw bytes (if reading as binary)
	if (content.charCodeAt(0) === 0xEF &&
		content.charCodeAt(1) === 0xBB &&
		content.charCodeAt(2) === 0xBF) {
		return { content: content.substring(3), fixed: true };
	}

	return { content, fixed: false };
}
```

**Fix 2: Normalize CONC Fields**

Strategy:
1. Join ALL CONC lines first (preserving structure)
2. Detect and repair split HTML entities
3. Decode double-encoded entities
4. Remove embedded newlines

```typescript
function normalizeConcFields(content: string): { content: string; fixCount: number } {
	const lines = content.split(/\r?\n/);
	const fixed: string[] = [];
	let fixCount = 0;
	let i = 0;

	while (i < lines.length) {
		const line = lines[i];

		// Check if this is a line followed by CONC continuations
		if (i + 1 < lines.length && /^\s*\d+\s+CONC\s/.test(lines[i + 1])) {
			// Collect all CONC lines
			const baseLevel = parseInt(line.match(/^\s*(\d+)/)?.[1] || '0');
			const concLevel = baseLevel + 1;
			const concRegex = new RegExp(`^\\s*${concLevel}\\s+CONC\\s+(.*)$`);

			let accumulated = line;
			let j = i + 1;

			while (j < lines.length && concRegex.test(lines[j])) {
				const match = lines[j].match(concRegex);
				if (match) {
					// CONC means concatenate WITHOUT space (per GEDCOM spec)
					accumulated += match[1];
				}
				j++;
			}

			// Now process the accumulated content
			const processed = repairHtmlEntities(accumulated);
			if (processed.fixed) {
				fixCount++;
				fixed.push(processed.content);
			} else {
				fixed.push(accumulated);
			}

			i = j; // Skip past all CONC lines
		} else {
			// Not a CONC situation, keep line as-is
			fixed.push(line);
			i++;
		}
	}

	return {
		content: fixed.join('\n'),
		fixCount
	};
}

function repairHtmlEntities(text: string): { content: string; fixed: boolean } {
	let fixed = false;
	let result = text;

	// Note: Split entity repair not needed per real-world sample analysis.
	// MyHeritage splits at word boundaries, not mid-entity.

	// Step 1: Decode double-encoded entities
	// &amp;lt; -> &lt; -> <
	// &amp;gt; -> &gt; -> >
	// &amp;amp; -> &amp; -> &
	// &amp;quot; -> &quot; -> "
	// &amp;nbsp; -> &nbsp; -> (non-breaking space)

	const doubleEncodedPattern = /&amp;(lt|gt|amp|quot|nbsp|#\d+|#x[0-9a-fA-F]+);/gi;
	if (doubleEncodedPattern.test(result)) {
		fixed = true;
		// First decode: &amp;lt; -> &lt;
		result = result.replace(doubleEncodedPattern, '&$1;');
		// Second decode: &lt; -> <
		result = decodeHtmlEntities(result);
	}

	// Step 2: Decode single-encoded entities (also present in MyHeritage exports)
	// These appear mixed with double-encoded in the same record
	if (/&(?:lt|gt|nbsp);/i.test(result)) {
		fixed = true;
		result = decodeHtmlEntities(result);
	}

	// Step 3: Convert <br> tags to newlines (per @wilbry's decision)
	// Handles: <br>, <br/>, <br />, <BR />, etc.
	const brPattern = /<br\s*\/?>/gi;
	if (brPattern.test(result)) {
		fixed = true;
		result = result.replace(brPattern, '\n');
	}

	// Step 4: Strip decorative HTML tags that don't add meaning
	// <a>text</a> (without href) -> text
	// <p></p> -> (remove empty paragraphs)
	const decorativeAnchorPattern = /<a>([^<]*)<\/a>/gi;
	if (decorativeAnchorPattern.test(result)) {
		fixed = true;
		result = result.replace(decorativeAnchorPattern, '$1');
	}

	// Step 5: Remove embedded newlines (violate GEDCOM spec)
	const newlinePattern = /\\n|\\r\\n|\\r/g;
	if (newlinePattern.test(result)) {
		fixed = true;
		result = result.replace(newlinePattern, ' ');
	}

	return { content: result, fixed };
}

function decodeHtmlEntities(text: string): string {
	const entities: Record<string, string> = {
		'&lt;': '<',
		'&gt;': '>',
		'&amp;': '&',
		'&quot;': '"',
		'&apos;': "'",
		'&#39;': "'",
		'&nbsp;': ' '  // Non-breaking space -> regular space
	};

	let result = text;

	// Replace named entities
	for (const [entity, char] of Object.entries(entities)) {
		result = result.replace(new RegExp(entity, 'gi'), char);
	}

	// Replace numeric entities (&#60; or &#x3C;)
	result = result.replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num)));
	result = result.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

	return result;
}
```

#### 1.4 Preprocessing Orchestrator

```typescript
// gedcom-preprocessor.ts
export interface PreprocessResult {
	content: string;
	wasPreprocessed: boolean;
	fixes: {
		bomRemoved: boolean;
		concFieldsNormalized: number;
		detectionInfo: PreprocessorDetection;
	};
}

export async function preprocessGedcom(
	content: string,
	mode: 'auto' | 'myheritage' | 'none'
): Promise<PreprocessResult> {

	// Skip if disabled
	if (mode === 'none') {
		return {
			content,
			wasPreprocessed: false,
			fixes: {
				bomRemoved: false,
				concFieldsNormalized: 0,
				detectionInfo: {
					hasUtf8Bom: false,
					isMyHeritage: false,
					hasDoubleEncodedEntities: false,
					shouldPreprocess: false
				}
			}
		};
	}

	// Detect issues
	const detection = detectMyHeritage(content);

	// Should we preprocess?
	const shouldPreprocess = mode === 'myheritage' ||
		(mode === 'auto' && detection.shouldPreprocess);

	if (!shouldPreprocess) {
		return {
			content,
			wasPreprocessed: false,
			fixes: {
				bomRemoved: false,
				concFieldsNormalized: 0,
				detectionInfo: detection
			}
		};
	}

	// Apply fixes
	let processed = content;

	// Fix 1: Strip UTF-8 BOM
	const bomResult = stripUtf8Bom(processed);
	processed = bomResult.content;

	// Fix 2: Normalize CONC fields
	const concResult = normalizeConcFields(processed);
	processed = concResult.content;

	return {
		content: processed,
		wasPreprocessed: true,
		fixes: {
			bomRemoved: bomResult.fixed,
			concFieldsNormalized: concResult.fixCount,
			detectionInfo: detection
		}
	};
}
```

#### 1.5 Integration with GEDCOM Importer

```typescript
// Modify existing GEDCOM import modal/handler
async function importGedcom(file: File): Promise<ImportResult> {
	// Read file content
	const rawContent = await file.text();

	// Preprocess based on settings
	const compatMode = this.plugin.settings.gedcomCompatibilityMode;
	const preprocessed = await preprocessGedcom(rawContent, compatMode);

	// Log preprocessing results
	if (preprocessed.wasPreprocessed) {
		logger.info('importGedcom', 'MyHeritage compatibility fixes applied', {
			bomRemoved: preprocessed.fixes.bomRemoved,
			concFieldsFixed: preprocessed.fixes.concFieldsNormalized
		});
	}

	// Continue with existing GEDCOM parsing
	const gedcomContent = preprocessed.content;
	// ... existing parsing logic

	// Include preprocessing info in import results
	return {
		// ... existing import results
		preprocessingApplied: preprocessed.wasPreprocessed,
		preprocessingFixes: preprocessed.fixes
	};
}
```

#### 1.6 UI: Import Results Modal

Update import results modal to show preprocessing fixes:

```typescript
// In GEDCOM import results modal
if (importResult.preprocessingApplied) {
	const section = containerEl.createDiv({ cls: 'cr-import-preprocessing-section' });
	section.createEl('h3', { text: 'Compatibility Fixes Applied' });

	const details = section.createEl('ul');

	const fixes = importResult.preprocessingFixes;

	if (fixes.bomRemoved) {
		details.createEl('li', { text: 'Removed UTF-8 byte order mark (BOM)' });
	}

	if (fixes.concFieldsNormalized > 0) {
		details.createEl('li', {
			text: `Fixed ${fixes.concFieldsNormalized} malformed CONC fields (double-encoded entities)`
		});
	}

	const note = section.createDiv({ cls: 'cr-import-preprocessing-note' });
	note.createEl('p', {
		text: 'These fixes were applied automatically to improve MyHeritage GEDCOM compatibility. Your original file was not modified.'
	});
}
```

---

### Phase 2: Tab-Prefixed Continuation Lines (NEW)

**Discovered:** 2026-01-09 via anonymized sample from @wilbry (800KB, 42,191 lines)

#### 2.0 Problem Analysis

MyHeritage exports contain **non-standard continuation lines** that don't follow GEDCOM format. Instead of proper `CONC` tags for each continuation, MyHeritage produces:

**Observed (malformed):**
```gedcom
3 TEXT [some text]
4 CONC [first continuation]
	[second continuation - TAB PREFIX, NO LEVEL NUMBER]
	[third continuation - TAB PREFIX, NO LEVEL NUMBER]
4 CONC [fourth continuation]
[fifth continuation - NO PREFIX AT ALL]
```

**Expected (per GEDCOM spec):**
```gedcom
3 TEXT [some text]
4 CONC [first continuation]
4 CONC [second continuation]
4 CONC [third continuation]
4 CONC [fourth continuation]
4 CONC [fifth continuation]
```

**Impact on anonymized sample:**
- **1,008 lines** start with a tab character instead of a level number
- **~1,130 lines** start with plain text (no level number, no tab)
- **Total: 2,138 malformed lines** out of 42,191 (5% of file)

These lines cause the parser to throw "Invalid GEDCOM line format" because the regex `^(\d+)\s+(@[^@]+@\s+)?(\S+)(\s+(.*))?$` requires every line to start with a digit.

#### 2.1 Proposed Fix

Extend the preprocessor to normalize these continuation lines **before** parsing.

**Strategy A: Append to Previous Line (RECOMMENDED)**

When a line starts with tab or has no level number, append its content to the previous line:

```typescript
function normalizeTabContinuations(content: string): { content: string; fixCount: number } {
	const lines = content.split(/\r?\n/);
	const normalized: string[] = [];
	let fixCount = 0;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const trimmed = line.trimStart();

		// Check if line starts with a digit (valid GEDCOM) or is empty
		if (/^\d/.test(trimmed) || !trimmed) {
			normalized.push(line);
			continue;
		}

		// Line doesn't start with digit - it's a continuation
		// Check if it starts with tab (MyHeritage continuation pattern)
		if (line.startsWith('\t') || !line.match(/^\d/)) {
			if (normalized.length > 0) {
				// Append to previous line (with space separator)
				const prevIndex = normalized.length - 1;
				normalized[prevIndex] = normalized[prevIndex] + ' ' + trimmed;
				fixCount++;
			} else {
				// Edge case: first line is malformed, keep it
				normalized.push(line);
			}
		}
	}

	return { content: normalized.join('\n'), fixCount };
}
```

**Strategy B: Convert to Proper CONC Lines (Alternative)**

Insert proper CONC tags based on the previous line's level:

```typescript
// More complex, requires tracking level context
// May be needed if Strategy A breaks any data
```

**Decision: Use Strategy A** - Simpler, and CONC lines are already being joined by existing normalization. Appending to the previous line achieves the same result with less complexity.

#### 2.2 Integration Point

Add `normalizeTabContinuations()` as the first step in `preprocessGedcom()`, before `normalizeConcFields()`:

```typescript
export function preprocessGedcom(
	content: string,
	mode: GedcomCompatibilityMode
): PreprocessResult {
	// ... detection logic ...

	// Apply fixes
	let processed = content;

	// Fix 0: Strip UTF-8 BOM (existing)
	const bomResult = stripUtf8Bom(processed);
	processed = bomResult.content;

	// Fix 1: Normalize tab-prefixed continuations (NEW)
	const tabResult = normalizeTabContinuations(processed);
	processed = tabResult.content;

	// Fix 2: Normalize CONC fields and repair HTML entities (existing)
	const concResult = normalizeConcFields(processed);
	processed = concResult.content;

	return {
		content: processed,
		wasPreprocessed: true,
		fixes: {
			bomRemoved: bomResult.fixed,
			tabContinuationsFixed: tabResult.fixCount,  // NEW
			concFieldsNormalized: concResult.fixCount,
			detectionInfo: detection
		}
	};
}
```

#### 2.3 Detection Enhancement

Update `detectMyHeritage()` to also check for tab-prefixed lines:

```typescript
function detectMyHeritage(content: string): PreprocessorDetection {
	// ... existing checks ...

	// Check for tab-prefixed continuation lines (sample first 50KB)
	const hasTabContinuations = /^\t[^\t\n]/m.test(sample);

	return {
		hasUtf8Bom,
		isMyHeritage,
		hasDoubleEncodedEntities,
		hasTabContinuations,  // NEW
		shouldPreprocess: hasUtf8Bom || hasTabContinuations ||
			(isMyHeritage && hasDoubleEncodedEntities)
	};
}
```

#### 2.4 UI Update

Update import results to report tab continuation fixes:

```typescript
if (fixes.tabContinuationsFixed > 0) {
	details.createEl('li', {
		text: `Fixed ${fixes.tabContinuationsFixed} malformed continuation lines`
	});
}
```

#### 2.5 Testing

**Unit tests:**
```typescript
describe('Tab Continuation Normalization', () => {
	test('appends tab-prefixed lines to previous line', () => {
		const input = '3 TEXT Hello\n\tworld\n\tagain';
		const result = normalizeTabContinuations(input);
		expect(result.content).toBe('3 TEXT Hello world again');
		expect(result.fixCount).toBe(2);
	});

	test('handles lines with no prefix', () => {
		const input = '4 CONC First\nSecond\nThird';
		const result = normalizeTabContinuations(input);
		expect(result.content).toBe('4 CONC First Second Third');
		expect(result.fixCount).toBe(2);
	});

	test('preserves valid GEDCOM lines', () => {
		const input = '0 @I1@ INDI\n1 NAME John /Smith/';
		const result = normalizeTabContinuations(input);
		expect(result.content).toBe(input);
		expect(result.fixCount).toBe(0);
	});
});
```

**Integration test with anonymized sample:**
- Load `anonymized_file.ged`
- Verify no "Invalid GEDCOM line format" errors
- Verify expected number of persons/families imported

#### 2.6 Edge Cases

1. **First line malformed:** The anonymized sample has a malformed first line (anonymization artifact). Real MyHeritage files have `0 HEAD`. The fix should handle this gracefully - if the first line isn't valid, skip it or treat the whole line as content.

2. **Empty lines:** Preserve empty lines as-is (they're valid in GEDCOM).

3. **Lines with only whitespace:** ~~Trim and check - if empty after trim, preserve as empty line.~~ **Updated 2026-01-10:** Whitespace-only lines must be **skipped entirely**, not preserved. MyHeritage exports contain tab-only lines (e.g., `\t`) between continuation fragments. If these are preserved as new groups, subsequent continuation lines get appended to them, producing invalid output like `" [text]"` (space + content) instead of being appended to the previous valid GEDCOM line.

4. **Mixed tabs and spaces:** The anonymized sample shows tab-only prefixes. If real files use mixed whitespace, `trimStart()` handles both.

---

### Phase 3: Enhanced Reporting & Validation (Future)

#### 2.1 Detailed Fix Log

- Show before/after examples for each fix
- Export preprocessing report as markdown file
- Link to documentation explaining each fix

#### 2.2 Validation

- Check if fixes introduced any GEDCOM spec violations
- Warn if preprocessing may have changed data meaning
- Option to import without preprocessing if user prefers manual control

#### 2.3 Support for Other Vendors

Extend preprocessor to handle:
- Ancestry.com quirks
- FamilySearch export issues
- Other common GEDCOM problems

---

## Testing Strategy

### Unit Tests

```typescript
// tests/gedcom-preprocessor.test.ts

describe('MyHeritage GEDCOM Preprocessor', () => {

	describe('UTF-8 BOM Detection and Removal', () => {
		test('detects and removes UTF-8 BOM (U+FEFF)', () => {
			const withBom = '\uFEFF0 HEAD\n1 SOUR MyHeritage';
			const result = stripUtf8Bom(withBom);
			expect(result.fixed).toBe(true);
			expect(result.content).toBe('0 HEAD\n1 SOUR MyHeritage');
		});

		test('handles files without BOM', () => {
			const noBom = '0 HEAD\n1 SOUR MyHeritage';
			const result = stripUtf8Bom(noBom);
			expect(result.fixed).toBe(false);
			expect(result.content).toBe(noBom);
		});
	});

	describe('CONC Field Normalization', () => {
		test('fixes double-encoded HTML entities', () => {
			const input = `2 NOTE Pennsylvania&amp;lt;br&amp;gt;Age: 22`;
			const result = repairHtmlEntities(input);
			expect(result.fixed).toBe(true);
			expect(result.content).toContain('<br>');
			expect(result.content).not.toContain('&amp;');
		});

		test('preserves intentional single-encoded entities', () => {
			const input = `2 NOTE Smith &amp; Jones`;
			const result = repairHtmlEntities(input);
			// Single &amp; should decode to &
			expect(result.content).toContain('Smith & Jones');
		});

		test('joins CONC lines and repairs split entities', () => {
			const input = `2 NOTE Text&am\n3 CONC ;lt;br&amp;gt;More text`;
			const result = normalizeConcFields(input);
			expect(result.fixCount).toBeGreaterThan(0);
			// Should repair to: Text<br>More text
		});
	});

	describe('MyHeritage Detection', () => {
		test('detects MyHeritage via SOUR tag', () => {
			const content = '0 HEAD\n1 SOUR MyHeritage\n1 VERS 13.0';
			const detection = detectMyHeritage(content);
			expect(detection.isMyHeritage).toBe(true);
		});

		test('detects double-encoded entities', () => {
			const content = '2 NOTE Test&amp;lt;br&amp;gt;text';
			const detection = detectMyHeritage(content);
			expect(detection.hasDoubleEncodedEntities).toBe(true);
		});
	});

	describe('Full Preprocessing Pipeline', () => {
		test('applies all fixes when mode=myheritage', async () => {
			const problematic = '\uFEFF0 HEAD\n2 NOTE Test&amp;lt;br&amp;gt;';
			const result = await preprocessGedcom(problematic, 'myheritage');

			expect(result.wasPreprocessed).toBe(true);
			expect(result.fixes.bomRemoved).toBe(true);
			expect(result.content).not.toContain('\uFEFF');
			expect(result.content).toContain('<br>');
		});

		test('skips preprocessing when mode=none', async () => {
			const content = '\uFEFF0 HEAD\n2 NOTE Test&amp;lt;br&amp;gt;';
			const result = await preprocessGedcom(content, 'none');

			expect(result.wasPreprocessed).toBe(false);
			expect(result.content).toBe(content);
		});

		test('auto-detects and fixes MyHeritage files', async () => {
			const myHeritageFile = '\uFEFF0 HEAD\n1 SOUR MyHeritage\n2 NOTE &amp;lt;br&amp;gt;';
			const result = await preprocessGedcom(myHeritageFile, 'auto');

			expect(result.wasPreprocessed).toBe(true);
			expect(result.fixes.detectionInfo.isMyHeritage).toBe(true);
		});
	});
});
```

### Integration Tests

1. **Real MyHeritage GEDCOM** - Get sample file from @wilbry
2. **Other vendors** - Test with Ancestry, FamilySearch, Gramps exports to ensure no regressions
3. **Edge cases** - Empty files, corrupted files, very large files (100k+ lines)

### Manual Testing

- [ ] Import MyHeritage GEDCOM with BOM
- [ ] Import MyHeritage GEDCOM with malformed CONC fields
- [ ] Verify preprocessing report shows correct fix counts
- [ ] Verify original file is not modified
- [ ] Test with compatibility mode = 'auto', 'myheritage', 'none'
- [ ] Verify non-MyHeritage files are not incorrectly preprocessed

---

## Performance Considerations

### Concerns

1. **Large files** - MyHeritage trees with 10k+ people can generate 100k+ line GEDCOMs
2. **String operations** - Multiple passes over content (BOM strip, CONC normalization, entity decoding)
3. **Memory usage** - Holding full file content in memory during preprocessing

### Optimizations

1. **Single-pass processing** - Combine BOM strip and CONC normalization where possible
2. **Lazy evaluation** - Only decode entities in CONC lines that match the pattern
3. **Streaming** - For very large files (>5MB), consider line-by-line streaming
4. **Caching** - Cache preprocessing results keyed by file hash (for re-imports)

### Benchmarks (Target)

- Small file (1k lines): < 50ms preprocessing
- Medium file (10k lines): < 200ms preprocessing
- Large file (100k lines): < 1s preprocessing

---

## Documentation

### User-Facing

**Add to FAQ.md:**

#### Does Charted Roots support MyHeritage GEDCOM exports?

Yes! Charted Roots automatically detects and fixes common issues with MyHeritage GEDCOM exports, including:
- UTF-8 byte order marks (BOM)
- Malformed CONC continuation fields with double-encoded HTML entities
- Embedded newlines in source citations

You can control this behavior in Settings → Charted Roots → GEDCOM Import → Compatibility Mode:
- **Auto** (default): Automatically detect and fix MyHeritage files
- **MyHeritage**: Always apply MyHeritage fixes
- **None**: Disable preprocessing (advanced users only)

When fixes are applied, the import results will show what was corrected. Your original GEDCOM file is never modified.

**Add to Community Use Cases:**

See existing "Importing from Genealogy Software" section - add MyHeritage to the list with note about automatic compatibility fixes.

### Developer-Facing

**Add to CONTRIBUTING.md:**

Section on adding new vendor-specific preprocessors to `gedcom-preprocessor.ts`.

---

## Open Questions (Resolved)

### 1. CONC split entity repair

**Question:** What if MyHeritage splits entities mid-character (e.g., `&#6` + `0;`)?

**Decision:** Not a concern. Real-world sample from @wilbry shows entities are NOT split mid-character. MyHeritage splits at word/phrase boundaries, not mid-entity. No special repair logic needed beyond standard CONC joining.

### 2. Preserve vs. decode HTML tags

**Question:** Should we preserve `<br>` tags or decode them to newlines?

**Decision:** Replace `<br>` tags with actual newlines. Per @wilbry: "I think we can replace them, I think it was a limitation of how MyHeritage was displaying things and not allowing you to enter blank lines on your own." This applies to both `<br>`, `<br/>`, and `<BR />` variants.

### 3. Versioning

**Question:** Should we track which version of MyHeritage produced the file?

**Decision:** Not needed for MVP. The sample shows `1 SOUR MYHERITAGE` with `2 VERS 5.5.1` but version-specific behavior hasn't been observed. Can add later if needed.

### 4. User override (granular control)

**Question:** Should users be able to disable individual fixes?

**Decision:** No. Per @wilbry: "I think it doesn't need to be granular." The three-mode setting (auto/myheritage/none) is sufficient.

### 5. Test data

**Question:** Need real MyHeritage GEDCOM samples.

**Decision:** ✅ Resolved. @wilbry provided a sanitized sample in [issue #144](https://github.com/banisterious/obsidian-charted-roots/issues/144). Key findings from the sample:

**Observed patterns:**
- `1 SOUR MYHERITAGE` (uppercase) — use for detection
- Double-encoded entities: `&amp;lt;br&amp;gt;` in DATA/TEXT fields
- Single-encoded entities: `&lt;br&gt;`, `&lt;a&gt;`, `&amp;nbsp;` in DATA/TEXT fields
- HTML tags: `<a href="...">`, `<p>`, `</p>` in NOTE fields
- Mixed encoding within same record

**Entity types found:**
- `&amp;lt;` and `&amp;gt;` — double-encoded angle brackets
- `&amp;nbsp;` — double-encoded non-breaking space
- `&lt;br&gt;`, `&lt;BR /&gt;` — single-encoded line breaks
- `&lt;a&gt;`, `&lt;/a&gt;` — single-encoded anchor tags (display only, not links)

**CONC field behavior:**
- Lines split at ~100-120 character boundaries
- Splits occur mid-word but NOT mid-entity
- Level numbers are consistent (3 TEXT → 4 CONC)

---

## Success Criteria

- [ ] Non-technical users can import MyHeritage GEDCOMs without manual cleanup
- [ ] Import results transparently report all fixes applied
- [ ] No regression: other GEDCOM sources (Ancestry, FamilySearch, Gramps) import correctly
- [ ] Performance: preprocessing adds < 1 second to import time for typical files
- [ ] Documentation: users understand what compatibility mode does and when to use it

---

## References

- **GitHub Issue:** [#144](https://github.com/banisterious/obsidian-charted-roots/issues/144)
- **User Report:** @wilbry in [Discussion #142](https://github.com/banisterious/obsidian-plugins/discussions/142#discussioncomment-15425345)
- **GEDCOM Spec:** [GEDCOM 5.5.1 Specification](https://www.gedcom.org/gedcom.html) - Section on CONC and CONT tags
- **Related Issues:** None (first vendor-specific import fix)
