# Evidence Visualization - Implementation Plan

## Overview

Evidence Visualization transforms Canvas Roots from a tree builder into a serious research platform aligned with the **Genealogical Proof Standard (GPS)** and professional genealogical practices. This feature enables users to:

1. Track **fact-level source coverage** (which specific facts have evidence)
2. Classify **source quality** (primary, secondary, derivative)
3. View **research gaps** across their family tree
4. (Future) Document **proof arguments** and **conflicting evidence**

This plan covers **Phase 1** - the foundation for fact-level sourcing.

---

## Design Decisions

### Fact Tracking Location: Person Notes

**Decision: Track sourced facts in person notes** (Option B) rather than in source notes.

**Rationale:**
- Person is the "owner" of their facts - natural to track sourcing there
- Keeps source notes simple (they just document the source itself)
- Easier to display in person-centric UI (Control Center, canvas nodes)
- Aligns with how researchers think: "What do I know about John Smith?"
- Source notes remain reusable across multiple people/facts

### Sourced Facts Schema

New `sourced_facts` property on person notes:

```yaml
---
type: person
name: John Smith
birth_date: 1850-03-15
birth_place: "[[Ohio]]"
death_date: 1920-11-22
death_place: "[[Chicago]]"
parents:
  - "[[William Smith]]"
  - "[[Mary Jones]]"

# NEW: Fact-level source tracking
sourced_facts:
  birth_date:
    sources: ["[[1850 Census]]", "[[Family Bible]]"]
  birth_place:
    sources: ["[[1850 Census]]"]
  death_date:
    sources: ["[[Death Certificate]]"]
  death_place:
    sources: ["[[Death Certificate]]", "[[Obituary 1920]]"]
  parents:
    sources: ["[[1850 Census]]", "[[Marriage Record 1848]]"]
---
```

**Tracked Facts:**
| Fact Key | Description |
|----------|-------------|
| `birth_date` | Date of birth |
| `birth_place` | Place of birth |
| `death_date` | Date of death |
| `death_place` | Place of death |
| `parents` | Parent relationships |
| `marriage_date` | Marriage date(s) |
| `marriage_place` | Marriage place(s) |
| `spouse` | Spouse relationship(s) |
| `occupation` | Occupation(s) |
| `residence` | Place(s) of residence |

### Source Quality Classification

**Decision: Explicit `source_quality` field in source notes**, not inferred from source_type.

**Rationale:**
- A census *image* is primary; a census *transcription on Ancestry* is derivative
- Same source type can have different quality depending on what the user has
- User control matters for serious researchers
- Can default based on source_type but user can override

Addition to source note schema:

```yaml
---
type: source
cr_id: source-1900-census-smith
title: "1900 US Federal Census - Smith Family"
source_type: census
source_quality: primary  # NEW: primary | secondary | derivative
# ... existing fields
---
```

**Quality Definitions (per Elizabeth Shown Mills):**
| Quality | Definition | Examples |
|---------|------------|----------|
| `primary` | Created at or near the time of the event by a participant or witness | Original vital records, census enumeration, contemporary letters |
| `secondary` | Created later from memory or hearsay | Family bibles (entries added later), obituaries, oral histories |
| `derivative` | Copies, transcriptions, or abstracts of other sources | Database transcriptions, published abstracts, photocopies |

### UI Approach: Control Center First

**Decision: Build research tools in Control Center before canvas visualization.**

**Rationale:**
- Control Center is where research happens; canvas is for visualization
- Research Gaps Report in Data Quality tab is high value, low complexity
- Canvas enhancements can come in Phase 4 once the data model is solid
- Hover tooltips on existing source indicators can show fact breakdown as a quick win

---

## Casual User Safeguards

Evidence Visualization targets serious researchers, but Canvas Roots serves a broad audience. These safeguards ensure the feature enhances the plugin for power users without overwhelming casual users.

### Opt-In by Default

**Decision: `trackFactSourcing` defaults to `false`.**

- New users see the familiar, simple interface
- Research features only appear when explicitly enabled
- Prevents "feature overload" on first use
- Settings description explains who benefits: *"Enable detailed fact-level source tracking for genealogical research. Recommended for users following the Genealogical Proof Standard."*

### Feature Gating

When `trackFactSourcing` is disabled:

| Component | Behavior |
|-----------|----------|
| Research Gaps Report | Hidden from Data Quality tab |
| Person fact coverage | Not shown in person details |
| Enhanced tooltips | Show simple source count only (existing behavior) |
| `sourced_facts` property | Ignored in frontmatter (no errors) |
| `source_quality` field | Still parsed but not prominently displayed |

When enabled, all features become visible with a subtle "Research Mode" indicator.

### Progressive Disclosure

Rather than exposing all research terminology immediately:

1. **Level 1 (Default)**: Simple source counts ("3 sources attached")
2. **Level 2 (Enabled)**: Fact coverage percentages ("75% documented")
3. **Level 3 (Detailed view)**: Full GPS terminology (primary/secondary/derivative)

Users drill down to complexity only when they want it.

### User-Friendly Terminology

In UI, prefer accessible language with technical terms as secondary:

| Technical Term | User-Friendly Alternative |
|---------------|---------------------------|
| Primary source | Original record |
| Secondary source | Later account |
| Derivative source | Copy/transcription |
| Evidence | Supporting sources |
| GPS | Research standards |

Tooltips can explain: *"Original record (primary source) - created at the time of the event"*

### Separate Documentation

- **Main docs**: Focus on basic source linking (existing behavior)
- **Research Guide**: Dedicated section for GPS-aligned workflow
- **In-app help**: Context-sensitive tips only when research features are enabled

### Settings Organization

Group research settings under a collapsible "Research tools" section in plugin settings, clearly labeled as optional/advanced:

```
▼ Research tools (optional)
  □ Enable fact-level source tracking
  □ Show research coverage percentages
  Fact coverage threshold: [6]
```

### Graceful Degradation

If a user disables `trackFactSourcing` after using it:

- `sourced_facts` data preserved in frontmatter (not deleted)
- UI simply hides research features
- Re-enabling restores full functionality
- No data loss, no warnings

---

## Phase 1 Scope (v0.9.0)

### Included

| Component | Description |
|-----------|-------------|
| `sourced_facts` schema | New frontmatter property on person notes |
| `source_quality` field | New field on source notes |
| Research Gaps Report | New card in Data Quality tab |
| Person fact coverage display | Show sourced/unsourced facts when viewing a person |
| Enhanced source indicator tooltips | Hover on canvas badge to see fact breakdown |
| Schema validation | Validate `sourced_facts` structure |

### Excluded (Future Phases)

| Component | Phase |
|-----------|-------|
| Canvas visualization with colored borders | Phase 4 |
| Proof summary nodes | Phase 3 |
| Conflict detection and markers | Phase 3 |
| Evidence clusters on canvas | Phase 4 |

---

## Schema Details

### Person Note: sourced_facts

```yaml
sourced_facts:
  birth_date:
    sources: ["[[Source Note 1]]", "[[Source Note 2]]"]
  birth_place:
    sources: ["[[Source Note 1]]"]
  death_date:
    sources: []  # Explicitly tracked as unsourced
  # Omitted facts are considered unsourced
```

**Validation Rules:**
- `sourced_facts` must be an object if present
- Each fact key must be a string from the allowed list
- `sources` must be an array of strings (wikilinks)
- Empty `sources` array = explicitly tracked as unsourced
- Missing fact key = implicitly unsourced

### Source Note: source_quality

```yaml
source_quality: primary  # primary | secondary | derivative
```

**Default Inference (if not specified):**
| source_type | Default quality |
|-------------|-----------------|
| `census` | primary |
| `vital_record` | primary |
| `church_record` | primary |
| `military` | primary |
| `court_record` | primary |
| `land_deed` | primary |
| `probate` | primary |
| `photo` | primary |
| `correspondence` | primary |
| `newspaper` | secondary |
| `obituary` | secondary |
| `oral_history` | secondary |
| `custom` | secondary |

---

## UI Components

### 1. Research Gaps Report (Data Quality Tab)

New card in the Data Quality tab showing research coverage:

```
┌─────────────────────────────────────────────────┐
│ Research Gaps                               🔍  │
├─────────────────────────────────────────────────┤
│                                                 │
│ Unsourced Facts Summary                         │
│ ───────────────────                             │
│ Birth dates:    47 people missing sources       │
│ Death dates:    89 people missing sources       │
│ Parents:        23 people missing sources       │
│ Marriage dates: 34 people missing sources       │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ Filter by fact type: [All Facts      ▼]    │ │
│ │ Show only: [Unsourced ▼]                   │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ People with unsourced birth dates:              │
│ ├─ John Smith (1850-1920)                       │
│ ├─ Mary Jones (1855-1932)                       │
│ ├─ William Brown (1878-1945)                    │
│ └─ [Show 44 more...]                            │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Features:**
- Summary counts by fact type
- Filter by specific fact type
- Toggle between unsourced/partially sourced/all
- Clickable person names to open notes
- Export list to clipboard or CSV

### 2. Person Fact Coverage (People Tab / Person Detail)

When viewing a person's details, show fact coverage:

```
┌─────────────────────────────────────────────────┐
│ John Smith (1850-1920)                          │
├─────────────────────────────────────────────────┤
│ Research Coverage                          75%  │
│ ───────────────────                             │
│ ✅ Birth date     2 sources (primary)           │
│ ✅ Birth place    1 source                      │
│ ✅ Death date     1 source                      │
│ ✅ Death place    2 sources                     │
│ ✅ Parents        3 sources (primary)           │
│ ⚠️ Marriage date  1 source (secondary)          │
│ ❌ Marriage place no sources                    │
│ ❌ Occupation     no sources                    │
│                                                 │
│ [Add Source Citation...]                        │
└─────────────────────────────────────────────────┘
```

**Visual Indicators:**
| Status | Icon | Meaning |
|--------|------|---------|
| Well-sourced | ✅ | 2+ sources, at least one primary |
| Sourced | ✅ | 1+ sources |
| Weakly sourced | ⚠️ | Only secondary/derivative sources |
| Unsourced | ❌ | No sources |

### 3. Enhanced Source Indicator Tooltip

On canvas, hovering over the source badge (e.g., "📎 3") shows:

```
┌─────────────────────────────┐
│ Research Coverage: 75%      │
├─────────────────────────────┤
│ ✅ Birth: 2 sources         │
│ ✅ Death: 1 source          │
│ ✅ Parents: 3 sources       │
│ ⚠️ Marriage: 1 (secondary)  │
│ ❌ Occupation: unsourced    │
└─────────────────────────────┘
```

---

## Implementation Tasks

### 1. Schema & Types

- [ ] Define `SourcedFacts` TypeScript interface
- [ ] Define `SourceQuality` type (`'primary' | 'secondary' | 'derivative'`)
- [ ] Add `sourced_facts` to person note parsing
- [ ] Add `source_quality` to source note parsing
- [ ] Add schema validation rules for `sourced_facts`
- [ ] Add default quality inference for source types

### 2. Services

- [ ] Create `EvidenceService` class
  - `getFactCoverage(personCrId)` - returns sourced/unsourced facts for a person
  - `getResearchGaps()` - returns summary of unsourced facts across all people
  - `getSourceQuality(sourceCrId)` - returns quality (explicit or inferred)
  - `calculateCoveragePercent(personCrId)` - research completeness percentage

### 3. Data Quality Tab

- [ ] Add "Research Gaps" card to Data Quality tab
- [ ] Implement summary counts by fact type
- [ ] Add filtering by fact type
- [ ] Add person list with click-to-open
- [ ] Add export functionality

### 4. Person Detail View

- [ ] Add "Research Coverage" section to person detail
- [ ] Show fact-by-fact breakdown with status icons
- [ ] Show source quality indicators
- [ ] Add "Add Source Citation" action

### 5. Canvas Integration

- [ ] Extend existing source indicator with hover tooltip
- [ ] Show fact coverage breakdown on hover
- [ ] Include source quality in tooltip

### 6. Settings

- [ ] Add `trackFactSourcing` setting (default: false - opt-in)
- [ ] Add `factCoverageThreshold` setting (facts required for "complete")
- [ ] Group settings under collapsible "Research tools" section

---

## Settings

New settings in plugin configuration:

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `trackFactSourcing` | boolean | `false` | Enable fact-level source tracking (opt-in for research users) |
| `factCoverageThreshold` | number | `6` | Number of facts for 100% coverage |
| `showResearchGapsInStatus` | boolean | `true` | Show research gap summary in Status tab (when tracking enabled) |

---

## Migration Considerations

### Existing Vaults

Users with existing person notes will have no `sourced_facts` property. The system should:

1. Treat missing `sourced_facts` as "not yet tracked" (different from "explicitly unsourced")
2. Offer a "Scan Sources" action to auto-detect which sources link to which facts (heuristic based on wikilinks)
3. Allow gradual adoption - users can add `sourced_facts` as they do research

### Backward Compatibility

- Existing source counting (📎 3) continues to work unchanged
- `sourced_facts` is additive - no breaking changes
- `source_quality` defaults based on source_type if not specified

---

## Future Phases

### Phase 2: Source Quality Visualization

- Color-coded indicators based on source quality
- Quality summary in person views
- Filter research gaps by quality

### Phase 3: Proof Summary Nodes

- New `type: proof_summary` note type
- Document reasoning chains
- Link multiple sources to conclusions
- Conflict detection when sources disagree

### Phase 4: Canvas Evidence Visualization

- Evidence clusters grouped by research question
- Color-coded source quality borders on media nodes
- Conflict markers with linked analysis notes
- Research progress overlay (% of facts sourced)

---

## Success Criteria

Phase 1 is complete when:

1. Users can add `sourced_facts` to person notes and see coverage in Control Center
2. Research Gaps Report shows unsourced facts across the tree
3. Source quality can be specified and is displayed appropriately
4. Canvas source indicators show fact-level breakdown on hover
5. Schema validation catches malformed `sourced_facts`
6. Documentation covers the new workflow

---

## References

- [Genealogical Proof Standard](https://www.bcgcertification.org/ethics-standards/gps/)
- [Evidence Explained](https://www.evidenceexplained.com/) by Elizabeth Shown Mills
- [Source Classification](https://www.familysearch.org/en/wiki/Sources_and_Citations) - FamilySearch Wiki
