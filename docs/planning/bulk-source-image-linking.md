# Bulk Source-Image Linking

## Overview

**Priority:** 📋 Medium — Streamline bulk import of source images with metadata extraction

**Summary:** Import external source images (census records, vital records, photos, etc.) into the vault, parse filenames to extract metadata, and create source notes with media attached. Addresses the common genealogist workflow of having hundreds of inconsistently-named source images that need to be organized and linked.

---

## Problem Statement

Users have existing image files with inconsistent naming conventions that need to be matched to source notes. Manual matching is tedious for large collections (~100-500 images). Common pain points:

- **Inconsistent naming:** Files from different eras, scanning sessions, or sources follow different patterns
- **Scattered storage:** Source images often live outside the vault in archive folders
- **Manual linking:** Creating source notes and attaching media one-by-one is time-consuming
- **Multi-part documents:** Census pages, multi-page vital records need grouping into single sources

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Copy vs Move | Copy (default), Move (optional) | Genealogists keep originals in master archive |
| Person linking | Deferred to Phase 2 | Keep Phase 1 focused; manual linking via existing workflow |
| Auto-approve | Hybrid: high-confidence pre-checked, user confirms | Balance automation with control |
| Image location | User-configurable setting | Flexibility for different vault structures |

---

## Sample Dataset Analysis

Analysis based on a real genealogy collection (~280 files, ~140 actionable source images after excluding thumbnails).

### Observed Naming Patterns

| Pattern | Example | Extractable Data |
|---------|---------|------------------|
| `surname_year_type` | `thornwood_1870_census.jpg` | surname, year, type |
| `surname_given_byear_year_place_type` | `whitmore_chester_b1826_1870_USA_IL_census.jpg` | full structured |
| `surname_given_byear_type_part` | `thornwood_george_b1843_civil_war_record_a.jpg` | with multi-part |
| `surname_given_byear_type_card` | `calloway_edmond_eugene_b1880_wwi_draft_registration_card.jpg` | WWI draft |
| `surname_and_surname_various_...` | `calloway_and_pembrook_various_p7A_1910_USA_OK_census.jpg` | multi-family |
| `ss_shipname_pas_list_date` | `ss_george_washington_pas_list_1912-oct-28.jpg` | passenger list |
| Descriptive (spaces) | `Cemetery Record for Iowa - Frances Lindquist...` | free-form |

### Extracted Tokens

- **Surnames:** thornwood, whitmore, calloway, hartley, graves, pembrook, ashford, westbrook, fairchild, marston, aldridge, crawford, brennan, holcombe, stanton, kensington, fairbanks, winthrop, hartwell, kingsley, beaumont, aldrich, lindquist, ashworth, wakefield
- **Record types:** census, civil_war_record, wwi_draft_reg_card, wwii_draft_reg_card, birth_record, marriage_record, divorce, obit, family_record, pas_list (passenger list)
- **Place codes:** USA_IL, USA_MI, USA_OK, USA_TN, USA_OH, USA_KY, USA_MO, USA_IN, USA_VT, USA_MA, USA_CA, USA_AR, england
- **Multi-part suffixes:** `_a`, `_b`, `_2a`, `_2b`, `_p1`, `_p2`, `_page1`, `_page2`, `_allparts`, `_02`
- **Uncertainty markers:** `_maybe`, `_pos_wrong`
- **Thumbnails:** `thumb_*` prefix (should be filtered out)

---

## Implementation Phases

### Phase 1: Core Import Wizard

**Goal:** Import external images, parse filenames, create source notes with media attached.

#### 1.1 Filename Parser Service

**New file:** `src/sources/services/image-filename-parser.ts`

```typescript
interface ParsedImageFilename {
  originalFilename: string;
  surnames: string[];           // ['armitage'] or ['banister', 'hughes']
  givenNames: string[];         // ['chester'] or []
  birthYear?: number;           // 1826 from 'b1826'
  deathYear?: number;           // 1993 from 'd1993'
  recordYear?: number;          // 1870
  recordType?: string;          // 'census', 'military', 'vital_record'
  location?: {
    country?: string;           // 'USA'
    state?: string;             // 'IL'
  };
  partIndicator?: string;       // 'a', 'b', 'p2', 'page1'
  isMultiPart: boolean;
  uncertaintyMarker?: string;   // 'maybe', 'pos_wrong'
  confidence: 'high' | 'medium' | 'low';
}
```

**Functions:**

- `parseFilename(filename: string): ParsedImageFilename`
- `detectMultiPartGroups(filenames: string[]): Map<string, string[]>`
- `mapToSourceType(typeToken: string): SourceType`
- `extractLocation(tokens: string[]): { country?: string; state?: string }`
- `generateSourceTitle(parsed: ParsedImageFilename): string`
- `generateStandardFilename(parsed: ParsedImageFilename, extension: string): string`

#### 1.2 Import Wizard UI

**New file:** `src/sources/ui/source-image-wizard.ts`

**Wizard Steps:**

1. **Select Source** — Choose folder or files to process
   - Toggle: "Import from external folder" vs "Use existing vault folder"
   - External: Folder picker (external path)
   - Vault: Folder suggester for existing vault folders
   - File filter options (exclude `thumb_*`, `.doc`, etc.)
   - Show file count and preview

2. **Review Parsed Data** — Table with editable fields
   - Thumbnail | Filename | Surnames | Year | Type | Location | Group
   - Editable cells for corrections
   - Confidence indicator (color-coded)
   - Multi-part grouping visual indicator

3. **Rename Files** (optional) — Standardize filenames
   - Toggle: "Rename files to standard format"
   - Preview table: Current Name → Proposed Name
   - Editable proposed names for manual adjustments
   - Format based on parsed metadata: `surname_given_byyyy_type_yyyy_place.ext`
   - Checkbox per row to include/exclude from renaming
   - Warning for potential conflicts (duplicate names)

4. **Configure Import** — Settings for this import
   - Destination folder (default from settings) — only shown for external imports
   - Copy vs Move toggle — only shown for external imports
   - Source note folder

5. **Execute** — Progress bar and results
   - Copy/move images to vault (external import only)
   - Create source notes
   - Link media to sources
   - Summary: X sources created, Y images processed

#### 1.3 Settings & Integration

**Modified files:**

- `src/types/settings.ts` — Add `sourceMediaFolder` setting
- `src/ui/settings-tab.ts` — Add setting UI
- `src/sources/ui/sources-tab.ts` — Add "Import source images" button

---

### Phase 2: Person Matching

**Goal:** Match images/sources to existing person notes.

#### 2.1 Matching Service

**New file:** `src/sources/services/image-matcher.ts`

```typescript
interface PersonMatch {
  person: PersonNode;
  confidence: 'high' | 'medium' | 'low';
  matchReason: string;  // "surname + birth year", "surname only"
}

interface ImageMatchResult {
  image: ParsedImageFilename;
  personMatches: PersonMatch[];
  suggestedSourceType: SourceType;
  suggestedTitle: string;
  groupWith?: string[];
}
```

**Functions:**

- `findPersonMatches(parsed: ParsedImageFilename, people: PersonNode[]): PersonMatch[]`
- `scoreMatch(parsed: ParsedImageFilename, person: PersonNode): number`
- `analyzeImages(images: ParsedImageFilename[], people: PersonNode[]): ImageMatchResult[]`

#### 2.2 Enhanced Wizard Step

- Add "Match to People" step between Review and Configure
- Show suggested person matches with confidence
- Allow user to confirm/reject/modify matches
- Add matched people to source note "People Named" section

---

### Phase 3: Fact-Level Linking

**Goal:** Link sources to specific facts on person notes via `sourced_facts`.

#### 3.1 Fact Linking UI

- After person match, prompt: "Which facts does this source support?"
- Checkboxes for: birth_date, birth_place, death_date, parents, residence, etc.
- Auto-suggest based on source type (census → residence, birth_date approx)

#### 3.2 sourced_facts Updates

- Update matched person notes' `sourced_facts` frontmatter
- Add source wikilink to selected fact entries

---

### Phase 4: Advanced Features

**Goal:** Additional quality-of-life improvements.

- **Duplicate detection:** Warn if image already exists in vault
- **Source note matching:** Link to existing source instead of creating new
- **OCR integration:** Extract text from images (future)

---

## Multi-Part Image Handling

**Detection patterns:**

- Letter suffixes: `_a`, `_b`, `_c`
- Number suffixes: `_1`, `_2`, `_01`, `_02`
- Page indicators: `_p1`, `_p2`, `_page1`, `_page2`
- Combined: `_2a`, `_2b`
- Special: `_allparts` (single combined image)

**Grouping logic:**

1. Strip suffix to get base name
2. Group all images with same base name
3. Sort by suffix (a < b, 1 < 2)
4. Create single source note with all images as `media`, `media_2`, etc.

---

## Type Mapping: Filename Tokens → Source Types

| Token(s) | Source Type | Notes |
|----------|-------------|-------|
| `census` | `census` | |
| `civil_war_record`, `civil_war` | `military` | |
| `wwi_draft`, `wwii_draft`, `draft_reg` | `military` | Draft registration |
| `birth_record`, `birth` | `vital_record` | |
| `marriage_record`, `marriage` | `vital_record` | |
| `death_record`, `death` | `vital_record` | |
| `divorce` | `court_record` | |
| `obit`, `obituary` | `obituary` | |
| `pas_list`, `passenger` | `immigration` | Ship passenger list |
| `family_record` | `custom` | Family bible, etc. |
| `photo` | `photo` | |

---

## Files to Create/Modify

### Phase 1

**New Files:**

- `src/sources/services/image-filename-parser.ts` — Parser logic (~300 lines)
- `src/sources/ui/source-image-wizard.ts` — Import wizard modal (~500 lines)

**Modified Files:**

- `src/sources/ui/sources-tab.ts` — Add "Import source images" button
- `src/types/settings.ts` — Add `sourceMediaFolder: string` setting
- `src/ui/settings-tab.ts` — Add setting UI for media folder

### Phase 2

**New Files:**

- `src/sources/services/image-matcher.ts` — Person matching logic

**Modified Files:**

- `src/sources/ui/source-image-wizard.ts` — Add matching step

---

## Recommended Naming Convention

Document for users (not enforced):

```
surname_givenname_byyyy_recordtype_yyyy_place.ext
```

Examples:

- `thornwood_george_b1843_census_1870_USA_TN.jpg`
- `calloway_lawrence_ward_b1878_wwi_draft_1917_USA_OK.jpg`
- `kensington_james_b1791_birth_record.png`

---

## Testing Plan

1. **Parser unit tests** — Test various filename patterns
2. **Multi-part grouping tests** — Ensure correct grouping
3. **Integration test** — Import real-world image collection
4. **Edge cases:**
   - Files with spaces in names
   - Unicode characters
   - Very long filenames
   - Missing/unparseable data

---

## Related Features

- [Source Media Gallery](../Release-History#source-media-gallery--document-viewer-v080) — Existing media management
- [Evidence Visualization](../Release-History#evidence-visualization-v090) — GPS-aligned research methodology
- [GEDCOM Import v2](../Release-History#gedcom-import-v2-v0101) — Source record import from GEDCOM

---

## Open Questions

1. **External file access:** How to handle file picker for external folders on mobile?
2. **Thumbnail generation:** Should we generate thumbnails for large images during import?
3. **Existing source matching:** How aggressively should we suggest linking to existing sources?
