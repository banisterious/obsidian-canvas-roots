# Gramps Source Import

## Status

**Phase 1:** ✅ Complete (2025-12-15)
**Phase 2:** ✅ Complete (2025-12-15)

## Overview

**Priority:** ✅ Complete

**Summary:** Import source and citation records from Gramps XML files, creating Canvas Roots source notes with full metadata and linking citations to person/event notes. This completes the Gramps migration path by handling the remaining entity type not currently imported.

---

## Problem Statement

Gramps XML import currently supports people, places, and events, but source/citation records are not imported. Users migrating from Gramps must:

1. Manually recreate their source documentation, OR
2. Re-import via GEDCOM (which loses Gramps-specific metadata)

This creates significant friction for users with extensive source documentation in Gramps who want to migrate to Canvas Roots.

---

## Gramps Data Structure

### Sources

```xml
<source handle="_100f30e032ad4f9c70cdf9a910bc" id="S0001">
  <stitle>Family Bible</stitle>
  <sauthor>Family records</sauthor>
  <spubinfo>Private collection</spubinfo>
  <noteref hlink="_100f30e032ad785c4be47a409fa0"/>
</source>
```

**Fields:**
| XML Element | Description |
|-------------|-------------|
| `handle` | Internal Gramps identifier |
| `id` | User-visible Gramps ID (e.g., S0001) |
| `<stitle>` | Source title/name |
| `<sauthor>` | Author/creator |
| `<spubinfo>` | Publication info (publisher, date, location) |
| `<noteref>` | Reference to attached note |
| `<sabbrev>` | Abbreviation (not in sample, but supported) |
| `<reporef>` | Reference to repository (not in sample) |

### Citations

```xml
<citation handle="_100f30e032df3f8ddb1a365e7846" id="C0000">
  <confidence>2</confidence>
  <sourceref hlink="_100f30e032c1102b57a270f5b37a"/>
</citation>
```

**Fields:**
| XML Element | Description |
|-------------|-------------|
| `handle` | Internal Gramps identifier |
| `id` | User-visible Gramps ID (e.g., C0000) |
| `<confidence>` | 0-4 scale (0=very low, 4=very high) |
| `<sourceref>` | Link to parent source |
| `<page>` | Page/volume details (not in sample) |

### Citation References on Events

```xml
<event handle="_100f30e032d54d65e52c62478969" id="E0000">
  <type>Birth</type>
  <dateval val="1905-03-12"/>
  <place hlink="_100f30e032e97389a0a9b8eb507d"/>
  <citationref hlink="_100f30e032df3f8ddb1a365e7846"/>
</event>
```

Events reference citations via `<citationref>`, which then reference sources.

### Notes

```xml
<note handle="_100f30e032ad785c4be47a409fa0" id="N0000" type="Source text">
  <text>Contains birth, death, and marriage records passed down through generations.</text>
</note>
```

Notes can be attached to sources and contain research notes or descriptions.

---

## Field Mapping

### Source Fields

| Gramps Field | Canvas Roots Field | Notes |
|--------------|-------------------|-------|
| `<stitle>` | `title` | Direct mapping |
| `<sauthor>` | `author` | Direct mapping |
| `<spubinfo>` | `repository` | Publication info → repository |
| `<sabbrev>` | `abbreviation` | If present |
| `handle` | `gramps_handle` | For re-import (Phase 2) |
| `id` | `gramps_id` | For re-import (Phase 2) |
| `<noteref>` → note text | Note body content | Append to note body |

### Confidence Mapping

| Gramps Value | Meaning | Canvas Roots Value |
|--------------|---------|-------------------|
| 0 | Very Low | `low` |
| 1 | Low | `low` |
| 2 | Normal | `medium` |
| 3 | High | `high` |
| 4 | Very High | `high` |

### Source Type Inference

Gramps sources don't have explicit types. Infer from title/author patterns:

| Pattern Match | Canvas Roots Type |
|---------------|-------------------|
| "Census" in title | `census` |
| "Vital Records", "Birth", "Death", "Marriage" in title | `vital_record` |
| "Church", "Parish", "Baptism", "Burial" | `church_record` |
| "Military", "Draft", "Service" | `military` |
| "Immigration", "Passenger", "Naturalization" | `immigration` |
| "Newspaper" | `newspaper` |
| "Bible" | `custom` (family bible) |
| "Social Security" | `vital_record` |
| Default | `custom` |

---

## Implementation Phases

### Phase 1: Core Import ✅

**Status:** Complete (2025-12-15)

**Goal:** Import sources and link citations to events/persons.

**Implemented:**
- Source and citation type definitions in `gramps-types.ts`
- Parser methods for sources, citations, and notes in `gramps-parser.ts`
- Source import phase in `gramps-importer.ts` with citation-to-source linking
- Progress modal integration (reuses GEDCOM modal with updated title)
- Import options UI toggle for source notes

#### 1.1 Type Definitions

**Modified file:** `src/gramps/gramps-types.ts`

```typescript
export interface GrampsSource {
  handle: string;
  id: string;
  title: string;
  author?: string;
  pubinfo?: string;
  abbrev?: string;
  noteRefs: string[];
  repoRef?: string;
}

export interface GrampsCitation {
  handle: string;
  id: string;
  confidence: number;  // 0-4
  sourceRef: string;   // handle of source
  page?: string;
}

export interface GrampsNote {
  handle: string;
  id: string;
  type: string;
  text: string;
}
```

**Update `GrampsDatabase`:**

```typescript
export interface GrampsDatabase {
  // Existing
  persons: GrampsPerson[];
  families: GrampsFamily[];
  events: GrampsEvent[];
  places: GrampsPlace[];
  // New
  sources: GrampsSource[];
  citations: GrampsCitation[];
  notes: GrampsNote[];
}
```

#### 1.2 Parser Updates

**Modified file:** `src/gramps/gramps-parser.ts`

Add parsing methods:

```typescript
private parseSources(doc: Document): GrampsSource[]
private parseCitations(doc: Document): GrampsCitation[]
private parseNotes(doc: Document): GrampsNote[]
private parseSource(element: Element): GrampsSource
private parseCitation(element: Element): GrampsCitation
private parseNote(element: Element): GrampsNote
```

Update `parseDatabase()` to call new methods and populate the database.

#### 1.3 Importer Updates

**Modified file:** `src/gramps/gramps-importer.ts`

Add import phase for sources:

```typescript
// New maps for linking
private sourceHandleToCrId: Map<string, string> = new Map();
private citationHandleToSourceCrId: Map<string, string> = new Map();

// New methods
private async importSources(
  sources: GrampsSource[],
  notes: GrampsNote[],
  progressCallback?: (progress: ImportProgress) => void
): Promise<void>

private inferSourceType(title: string, author?: string): SourceType

private mapGrampsConfidence(confidence: number): SourceConfidence

private getSourceNoteBody(source: GrampsSource, notes: GrampsNote[]): string
```

Update `importFile()` to:
1. Parse sources, citations, notes
2. Create source notes (after places, before people)
3. Build citation-to-source mapping
4. When creating events, look up citations and add source wikilinks

#### 1.4 Progress Modal Updates

**Modified file:** `src/ui/gedcom-import-progress-modal.ts`

The existing GEDCOM import progress modal already supports a `sources` phase. Ensure the Gramps importer uses the same progress callback pattern.

**Update `ImportPhase` if needed** (already includes `'sources'`):

```typescript
export type ImportPhase =
  | 'validating'
  | 'parsing'
  | 'places'
  | 'sources'  // Already present
  | 'people'
  | 'relationships'
  | 'events'
  | 'complete';
```

**New file (optional):** `src/ui/gramps-import-progress-modal.ts`

If the Gramps import needs distinct phases, create a dedicated modal. Otherwise, reuse `GedcomImportProgressModal` with updated title.

#### 1.5 Citation Linking

When creating event notes, add source references:

```typescript
// In event creation
const citationRefs = event.citationRefs || [];
const sourceWikilinks: string[] = [];

for (const citationHandle of citationRefs) {
  const sourceCrId = this.citationHandleToSourceCrId.get(citationHandle);
  if (sourceCrId) {
    const sourceFile = this.findSourceFileByCrId(sourceCrId);
    if (sourceFile) {
      sourceWikilinks.push(`[[${sourceFile.basename}]]`);
    }
  }
}

// Add to event frontmatter
if (sourceWikilinks.length > 0) {
  eventData.sources = sourceWikilinks;
}
```

#### 1.6 Import Options

**Modified file:** `src/types/settings.ts` or import options interface

Add option to control source import:

```typescript
interface GrampsImportOptions {
  // Existing
  createPlaceNotes: boolean;
  createEventNotes: boolean;
  // New
  createSourceNotes: boolean;  // default: true
}
```

---

### Phase 2: Extended Features ✅

**Status:** Complete (2025-12-15)

**Implemented:**
- Repository support (2.1): Parses `<repositories>` and `<reporef>` elements, stores `repository`, `repository_type`, and `source_medium` on source notes
- Media references (2.2): Parses `<objref>` elements, stores handles in `gramps_media_refs` frontmatter for manual resolution via Source Media Gallery
- Source property aliases (2.3): Added `CANONICAL_SOURCE_PROPERTIES` and `SOURCE_PROPERTY_METADATA` to property alias service, integrated into Preferences UI
- Gramps ID preservation (2.4): Stores `gramps_handle` and `gramps_id` on source notes for re-import scenarios

#### 2.1 Repository Support

Parse `<repositories>` section and `<reporef>` on sources.

**Gramps XML Structure:**

```xml
<repositories>
  <repository handle="_100f5a92e8dc1305b33efa2a3c72" id="R0000">
    <rname>FamilySearch</rname>
    <type>Library</type>
  </repository>
</repositories>
```

Sources reference repositories via `<reporef>`:

```xml
<source handle="_100f5a95a79023e38002377c7258" id="S0000">
  <stitle>1920 US Census</stitle>
  <reporef hlink="_100f5a92e8dc1305b33efa2a3c72" medium="Book"/>
</source>
```

**Design Decision:** Store repository metadata on source notes (not separate repository notes). This keeps data together and simplifies the import while preserving all information. Future upgrades could extract repositories into separate notes if demand exists.

**Implementation:**

1. Parse `<repositories>` and build a handle-to-repository map
2. When creating source notes, resolve `reporef` and add fields:

```yaml
repository_name: "FamilySearch"
repository_type: "Library"
source_medium: "Book"
```

**Repository Types in Gramps:**
- Library, Archive, Cemetery, Church, Collection, Repository, Web site, Unknown

#### 2.2 Media References

Parse `<objref>` on sources for attached media:

```xml
<source handle="_abc">
  <stitle>Census Image</stitle>
  <objref hlink="_media123"/>
</source>
```

**Design Decision:** Note missing media for user to resolve manually. Store the reference metadata (`gramps_media_ref`) so users can identify what needs to be attached. Users can then use the existing Source Media Gallery feature to manually attach files.

**Implementation:**

1. Parse `<objref>` elements on sources
2. Add `gramps_media_refs` field to source frontmatter (array of handles)
3. Log warning for each media reference that needs resolution
4. User manually imports media files and links them via Source Media Gallery

#### 2.3 Source Property Alias Support

Add source properties to the property alias system, enabling users to customize property names for source notes.

**Current State:** The property alias service (`src/core/property-alias-service.ts`) supports person, event, and place properties, but not source properties. The `PropertyMetadata` interface defines a `source` category, but no `CANONICAL_SOURCE_PROPERTIES` or `SOURCE_PROPERTY_METADATA` arrays exist.

**Implementation:**

1. Define canonical source properties in `property-alias-service.ts`:

```typescript
export const CANONICAL_SOURCE_PROPERTIES = [
  'title',
  'author',
  'source_type',
  'repository',
  'confidence',
  'url',
  'access_date',
  'citation_detail'
] as const;
```

2. Add source property metadata:

```typescript
export const SOURCE_PROPERTY_METADATA: PropertyMetadata[] = [
  {
    canonical: 'title',
    category: 'source',
    description: 'Source title or name',
    examples: ['1920 United States Census', 'Family Bible']
  },
  {
    canonical: 'author',
    category: 'source',
    description: 'Author or creator of the source',
    examples: ['U.S. Census Bureau', 'State Archives']
  },
  {
    canonical: 'source_type',
    category: 'source',
    description: 'Type of source record',
    examples: ['census', 'vital_record', 'church_record']
  },
  {
    canonical: 'repository',
    category: 'source',
    description: 'Archive or website where source is held',
    examples: ['Ancestry.com', 'FamilySearch', 'State Archives']
  },
  {
    canonical: 'confidence',
    category: 'source',
    description: 'Confidence level in the source',
    examples: ['high', 'medium', 'low']
  },
  {
    canonical: 'url',
    category: 'source',
    description: 'URL to online source',
    examples: ['https://www.ancestry.com/...']
  },
  {
    canonical: 'access_date',
    category: 'source',
    description: 'Date the source was accessed',
    examples: ['2024-01-15']
  },
  {
    canonical: 'citation_detail',
    category: 'source',
    description: 'Specific citation details (page, volume, etc.)',
    examples: ['Page 5, Line 23']
  }
];
```

3. Update `ALL_CANONICAL_PROPERTIES` and `ALL_PROPERTY_METADATA` to include source properties

4. Update settings UI to show source property aliases in the property alias configuration

**Use Cases:**
- User prefers `creator` instead of `author`
- User prefers `archive` instead of `repository`
- User prefers `source_url` instead of `url`

---

#### 2.4 Gramps ID Preservation

Store original Gramps IDs for re-import scenarios:

```yaml
gramps_handle: _100f30e032ad4f9c70cdf9a910bc
gramps_id: S0001
```

**Use Case:** User imports their Gramps file, continues working in Gramps, then re-imports an updated file. With preserved IDs, the importer can:
- Recognize existing sources by `gramps_handle`
- Update rather than create duplicates
- Maintain link integrity

**Implementation:**

1. Add `gramps_handle` and `gramps_id` fields to source frontmatter during import
2. On re-import, check for existing notes with matching `gramps_handle`
3. If found, update the existing note instead of creating a duplicate

---

## Files to Create/Modify

### Phase 1

**Modified Files:**

| File | Changes |
|------|---------|
| `src/gramps/gramps-types.ts` | Add `GrampsSource`, `GrampsCitation`, `GrampsNote` interfaces |
| `src/gramps/gramps-parser.ts` | Add `parseSources()`, `parseCitations()`, `parseNotes()` methods |
| `src/gramps/gramps-importer.ts` | Add source import phase, citation linking |
| `src/ui/gedcom-import-progress-modal.ts` | Ensure Gramps uses same progress pattern (or create dedicated modal) |

**Estimated Lines:**
- Types: ~50 lines
- Parser additions: ~150 lines
- Importer additions: ~200 lines
- Progress modal: ~50 lines (if new modal needed)

**Total: ~450 lines**

### Phase 2

**New/Modified Files:**

| File | Changes |
|------|---------|
| `src/gramps/gramps-types.ts` | Add `GrampsRepository`, `GrampsMedia` interfaces |
| `src/gramps/gramps-parser.ts` | Add repository and media parsing |
| `src/gramps/gramps-importer.ts` | Add repository handling, media linking, Gramps ID preservation |
| `src/core/property-alias-service.ts` | Add `CANONICAL_SOURCE_PROPERTIES`, `SOURCE_PROPERTY_METADATA` |
| `src/ui/settings/property-alias-settings.ts` | Add source property section to settings UI |

---

## Import Flow

```
┌─────────────────────────────────────┐
│  Gramps XML File (.gramps)          │
└─────────────────┬───────────────────┘
                  │
                  ▼
    ┌─────────────────────────────────┐
    │  1. Decompress (gzip)           │
    │  2. Validate XML                │
    └─────────────────┬───────────────┘
                  │
                  ▼
    ┌─────────────────────────────────┐
    │  3. Parse all entities          │
    │     - Sources                   │
    │     - Citations                 │
    │     - Notes                     │
    │     - Events (with citationrefs)│
    │     - People                    │
    │     - Families                  │
    │     - Places                    │
    └─────────────────┬───────────────┘
                  │
                  ▼
    ┌─────────────────────────────────┐
    │  4. Create notes (ordered)      │
    │     a. Places                   │
    │     b. Sources ← NEW            │
    │     c. People (pass 1)          │
    │     d. Events (with source refs)│
    │     e. Relationships (pass 2)   │
    └─────────────────┬───────────────┘
                  │
                  ▼
    ┌─────────────────────────────────┐
    │  5. Import complete             │
    │     - Show summary with counts  │
    └─────────────────────────────────┘
```

---

## Testing Plan

### Unit Tests

1. **Parser tests** — Verify correct extraction of source/citation/note data
2. **Confidence mapping** — Test all 5 Gramps levels map correctly
3. **Source type inference** — Test pattern matching on titles

### Integration Tests

1. **Sample file import** — Use `gedcom-testing/gramps-app-export-test.gramps`
   - Expected: 8 sources created
   - Expected: Citations linked to events
   - Expected: Notes attached to source bodies

2. **Round-trip verification**
   - Import Gramps file
   - Verify source notes have correct frontmatter
   - Verify events reference sources

### Edge Cases

1. Sources with no notes
2. Citations with no confidence (default to medium)
3. Events with multiple citations
4. Orphan citations (no matching source)
5. Sources with special characters in titles

---

## Sample Output

### Source Note

**File:** `Sources/State Vital Records.md`

```markdown
---
cr_type: source
cr_id: abc-123-def-456
title: State Vital Records
author: State Department of Health
source_type: vital_record
repository: State Archives
confidence: high
---

Official birth, death, and marriage certificates.
```

### Event Note (with source reference)

**File:** `Events/Birth of John Smith (1905).md`

```markdown
---
cr_type: event
cr_id: xyz-789-uvw-012
event_type: birth
date: 1905-03-12
place: "[[Boston, Suffolk County, Massachusetts, USA]]"
persons:
  - "[[John Smith]]"
sources:
  - "[[State Vital Records]]"
---
```

---

## Related Features

- [GEDCOM Import v2](../../wiki-content/Release-History#gedcom-import-v2-v0101) — Source record import from GEDCOM
- [Evidence Visualization](../../wiki-content/Release-History#evidence-visualization-v090) — GPS-aligned research methodology
- [Source Media Gallery](../../wiki-content/Release-History#source-media-gallery--document-viewer-v080) — Media management

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Duplicate sources** | Create with suffix (e.g., "State Vital Records (2)") | Consistent with Obsidian's duplicate handling; avoids data loss |
| **Citation page details** | Store in source note body for Phase 1 | Page details are rare in sample data, primarily for human reference; queryable `citations` field can be added in Phase 2 if needed |
| **Multiple citations** | Array format (`sources: [...]`) | Easier Dataview queries, no arbitrary limit, consistent with `persons` on events |

---

## References

- [Gramps XML DTD](http://gramps-project.org/xml/1.7.2/grampsxml.dtd)
- Sample files:
  - `gedcom-testing/gramps-app-export-test.gramps` — Phase 1 test data (sources, citations, notes)
  - `gedcom-testing/gramps-app-export-test2.gramps` — Phase 2 test data (includes repository with `reporef`)
