# Special Character Sanitization

Planning document for consistent special character handling in name fields during import.

- **Status:** Implemented
- **GitHub Issue:** [#139](https://github.com/banisterious/obsidian-charted-roots/issues/139)
- **Created:** 2026-01-07

---

## Overview

Ensure consistent sanitization of special characters in name fields across all importers to prevent wikilink resolution failures. The core problem is a mismatch between filename sanitization and wikilink content, causing Data Quality warnings like "person linked to father who doesn't exist" or "Circular reference".

### Goals

1. **Consistent sanitization** — Apply the same sanitization rules to both filenames AND wikilink content
2. **Preserve display names** — Use `[[sanitized-filename|Original Name]]` alias format when names differ
3. **Cross-importer parity** — Gramps, GEDCOM, GedcomX, and CSV importers should behave identically
4. **Graceful handling** — Names with special characters should "just work" without requiring source data cleanup

### Non-Goals

- Modifying original source data (that's the user's responsibility)
- Stripping all special characters from display names (aliases preserve originals)
- Changing how existing notes work (only affects import)

---

## Problem Statement

**Current behavior:**
- User imports data with names containing special characters (e.g., `Susan "Sue"`, `Susan (Sue)`, `?`)
- Filename sanitization removes problematic characters: `Susan Sue.md`
- Wikilink references use the original name: `father: "[[Susan "Sue"]]"`
- The wikilink doesn't resolve because no file named `Susan "Sue".md` exists
- Data Quality Analysis reports "father linked to person who doesn't exist" or "Circular reference"

**User report (jeff962):**
> "After import, if there are people in the source data who have special characters in their Given name, various warnings are generated... 'some_person linked to father who doesn't exist' or 'Circular reference'"

**Characters causing issues:**
- Quotes: `"` `'`
- Parentheses: `(` `)`
- Brackets: `[` `]` `{` `}`
- Question marks: `?`
- Other filesystem-illegal characters: `\` `:` `*` `<` `>` `|`

---

## Current Architecture

### Filename Sanitization (Inconsistent Across Importers)

**Gramps importer** (`gramps-importer.ts:1296-1303`):
```typescript
private generateFileName(name: string): string {
  const sanitized = name
    .replace(/[\\/:*?"<>|]/g, '-')  // Missing: () [] {}
    .replace(/\s+/g, ' ')
    .trim();
  return `${sanitized}.md`;
}
```

**GEDCOM importer** (`gedcom-importer-v2.ts:1243-1265`):
```typescript
private formatFilename(name: string, format: 'original' | 'kebab-case' | 'snake_case' = 'original'): string {
  const safeName = this.sanitizeName(name);  // Uses comprehensive sanitization
  // ...
}

private sanitizeName(name: string): string {
  const sanitized = name
    .replace(/[\\:*?"<>|()\[\]{}]/g, '')  // Comprehensive - strips () [] {}
    .trim();
  return sanitized || 'Unknown';
}
```

**PersonNoteWriter** (`person-note-writer.ts:1086-1091`):
```typescript
function formatFilename(name: string, format: FilenameFormat): string {
  const sanitized = name
    .replace(/[\\:*?"<>|()\[\]{}]/g, '')  // Comprehensive - matches GEDCOM
    .trim();
  const safeName = sanitized || 'Unknown';
  // ...
}
```

### Wikilink Creation (Name Not Sanitized)

**Gramps importer** (`gramps-importer.ts:765`):
```typescript
personData.fatherName = father.name || 'Unknown';  // Raw name, unsanitized
```

**PersonNoteWriter** (`person-note-writer.ts:268`):
```typescript
frontmatter[prop('father')] = `"${createSmartWikilink(person.fatherName, app)}"`;
// createSmartWikilink uses the name as-is for the wikilink target
```

### Wikilink Fix Phase (Only in GEDCOM)

**GEDCOM importer** (`gedcom-importer-v2.ts:733-802`):
- Has `fixWikilinkByCrId()` that compares `actualFilename` vs `displayName`
- When they differ, creates alias format: `[[actualFilename|displayName]]`
- **But**: The comparison uses `sanitizeName()` which strips `"`, so `"John Smith"` → `John Smith` → matches filename
- **Problem**: Gramps importer lacks this fix phase entirely

---

## Root Cause Analysis

The issue exists in **Gramps importer** specifically because:

1. **Incomplete filename sanitization** — `generateFileName()` doesn't strip `()` `[]` `{}`
2. **No name sanitization for wikilinks** — `fatherName` etc. use raw Gramps names
3. **No wikilink fix phase** — Unlike GEDCOM, Gramps doesn't have post-import wikilink correction

The GEDCOM importer was fixed in a previous release (mentioned in comments) but Gramps was not updated to match.

---

## Proposed Solution

### Phase 1: Unify Sanitization Functions

**Effort:** Low

Create a shared `sanitizeName()` utility that all importers use:

```typescript
// src/utils/name-sanitization.ts

/**
 * Characters that must be removed from names used in filenames or wikilinks.
 * These cause wikilink parsing issues or are filesystem-illegal.
 */
const WIKILINK_UNSAFE_CHARS = /[\\:*?"<>|()\[\]{}]/g;

/**
 * Sanitize a name for use in filenames and wikilinks.
 * Removes characters that break wikilink parsing or are filesystem-illegal.
 * @param name The original name
 * @returns Sanitized name, or 'Unknown' if empty after sanitization
 */
export function sanitizeName(name: string): string {
  const sanitized = name
    .replace(WIKILINK_UNSAFE_CHARS, '')
    .replace(/\s+/g, ' ')
    .trim();
  return sanitized || 'Unknown';
}
```

### Phase 2: Fix Gramps Importer

**Effort:** Medium

1. **Update `generateFileName()`** to use comprehensive sanitization:
   ```typescript
   private generateFileName(name: string): string {
     const sanitized = sanitizeName(name);
     return `${sanitized}.md`;
   }
   ```

2. **Sanitize relationship names** when populating personData:
   ```typescript
   if (father) {
     personData.fatherName = sanitizeName(father.name || 'Unknown');
   }
   ```

   Or better, keep original for display and use alias format in wikilinks.

3. **Add wikilink fix phase** (similar to GEDCOM importer):
   - After creating all person notes, scan for wikilink/filename mismatches
   - Use `[[filename|Original Name]]` alias format when names differ

### Phase 3: Ensure Alias Format for Display Names

**Effort:** Low

When the sanitized filename differs from the original name, always use alias format:

```typescript
function createWikilinkWithAlias(originalName: string, app: App): string {
  const sanitized = sanitizeName(originalName);
  if (sanitized !== originalName) {
    // Use alias format to preserve original name for display
    return `[[${sanitized}|${originalName}]]`;
  }
  return `[[${originalName}]]`;
}
```

This ensures:
- `Susan "Sue" Smith` → `[[Susan Sue Smith|Susan "Sue" Smith]]`
- Wikilink resolves to `Susan Sue Smith.md`
- Display shows original `Susan "Sue" Smith`

### Phase 4: Verify Other Importers

**Effort:** Low

Audit CSV and GedcomX importers for the same issue:
- Check `generateFileName()` / `sanitizeFilename()` implementations
- Ensure relationship name fields are sanitized consistently
- Add wikilink fix phase if missing

---

## Implementation Plan

### Step 1: Create Shared Utility
1. Create `src/utils/name-sanitization.ts`
2. Export `sanitizeName()` and `WIKILINK_UNSAFE_CHARS`
3. Add unit tests for edge cases (empty string, all special chars, etc.)

### Step 2: Update Gramps Importer
1. Import shared `sanitizeName()`
2. Update `generateFileName()` to use it
3. Add `sanitizeName()` calls for relationship name fields (father, mother, spouse, children)
4. Consider adding wikilink fix phase (may not be needed if names are sanitized upfront)
5. Test with jeff962's problematic .gpkg file

### Step 3: Update Other Importers
1. Replace local sanitization functions with shared utility
2. Ensure consistent behavior across GEDCOM, GedcomX, CSV
3. Add integration tests

### Step 4: Update PersonNoteWriter
1. Ensure `createSmartWikilink()` handles sanitized vs original name correctly
2. Use alias format when they differ

---

## Edge Cases

### 1. Name is entirely special characters

**Scenario:** `Given: ?` or `Given: ???`
**Behavior:** Sanitize to empty string → fallback to `Unknown`
**Result:** `Unknown.md` file, wikilink `[[Unknown|?]]`

### 2. Multiple people with same sanitized name

**Scenario:** `Susan "Sue"` and `Susan (Sue)` both sanitize to `Susan Sue`
**Behavior:** Second person gets suffix: `Susan Sue 1.md`
**Result:** Wikilinks use actual filenames via fix phase or alias format

### 3. Name has leading/trailing special characters

**Scenario:** `"John Smith"`
**Behavior:** Sanitize to `John Smith` (quotes removed, trimmed)
**Result:** `John Smith.md`, wikilink `[[John Smith|"John Smith"]]`

### 4. Unicode characters (accents, etc.)

**Scenario:** `José María García`
**Behavior:** Keep as-is (not in WIKILINK_UNSAFE_CHARS)
**Result:** `José María García.md`, no alias needed

### 5. Empty name after sanitization in nested structure

**Scenario:** Person with name `???` has children
**Behavior:** Parent becomes `Unknown.md`
**Result:** Child's `father` field points to `[[Unknown|???]]`

---

## Testing Plan

### Unit Tests

1. `sanitizeName()` with various inputs:
   - Normal name: `John Smith` → `John Smith`
   - Quotes: `Susan "Sue"` → `Susan Sue`
   - Parentheses: `Susan (Sue)` → `Susan Sue`
   - Brackets: `John [Jr]` → `John Jr`
   - Question mark: `?` → `Unknown`
   - Mixed: `"John" (Jack) [Jr.]` → `John Jack Jr.`
   - Empty: `` → `Unknown`
   - Whitespace only: `   ` → `Unknown`

2. `createWikilinkWithAlias()`:
   - Same name: `John Smith` → `[[John Smith]]`
   - Different: `Susan "Sue"` → `[[Susan Sue|Susan "Sue"]]`

### Integration Tests

1. Import Gramps .gpkg with problematic names
2. Verify no Data Quality warnings for "linked to person who doesn't exist"
3. Verify wikilinks resolve correctly
4. Verify display names show original (with special chars)

### Manual Tests (with jeff962's test file)

1. Import the .gpkg that produces 115 warnings
2. Run Data Quality Analysis
3. Confirm warning count is reduced to 0 (or near-zero)
4. Spot-check a few affected persons for correct wikilinks

---

## Alternatives Considered

### 1. Strip special characters from display names everywhere

**Approach:** Sanitize the name stored in frontmatter, not just filename
**Pros:** Simpler, no alias format needed
**Cons:** Loses original name information, user expectation violation

### 2. Use cr_id for all relationship links, drop wikilinks

**Approach:** Only use `father_id`, never `father` wikilink field
**Pros:** Avoids the problem entirely
**Cons:** Breaks existing behavior, removes human-readable links

### 3. Require users to clean source data

**Approach:** Document that special characters in names cause issues
**Pros:** No code changes
**Cons:** Poor UX, burden on user, jeff962 already tried this

---

## References

- [Issue #139](https://github.com/banisterious/obsidian-charted-roots/issues/139)
- [Issue #94](https://github.com/banisterious/obsidian-charted-roots/issues/94) (related, mentioned by ANYroots)
- GEDCOM importer fix: `gedcom-importer-v2.ts:1233-1238` (`sanitizeName()`)
- PersonNoteWriter sanitization: `person-note-writer.ts:1086-1091`

---

## Status

| Phase | Status |
|-------|--------|
| Phase 1 | Implemented |
| Phase 2 | Implemented |
| Phase 3 | Implemented |
| Phase 4 | Implemented |
