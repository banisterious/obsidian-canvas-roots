# Export Privacy & Sensitive Data Protection

Planning document for comprehensive privacy protection of sensitive genealogical data during exports and display.

- **Status:** Planning
- **GitHub Issue:** [#95](https://github.com/banisterious/obsidian-charted-roots/issues/95)
- **Sub-issues:**
  - [#96](https://github.com/banisterious/obsidian-charted-roots/issues/96) Phase 1: Sensitive field redaction
  - [#97](https://github.com/banisterious/obsidian-charted-roots/issues/97) Phase 2: Manual living status override (`cr_living`)
  - [#98](https://github.com/banisterious/obsidian-charted-roots/issues/98) Phase 3: Underscore-prefix privacy convention
  - [#99](https://github.com/banisterious/obsidian-charted-roots/issues/99) Phases 4-5: Deadname protection & export warnings
  - [#100](https://github.com/banisterious/obsidian-charted-roots/issues/100) Phase 6: Privacy feature discoverability
  - [#101](https://github.com/banisterious/obsidian-charted-roots/issues/101) Phase 7: Pronouns field support
  - [#102](https://github.com/banisterious/obsidian-charted-roots/issues/102) Phase 8: Privacy-aware canvas generation
- **Priority:** Medium
- **Created:** 2026-01-02
- **Updated:** 2026-01-02

---

## Overview

Genealogical data frequently contains sensitive personal information — government ID numbers, medical notes, previous names, and details about living persons. While Charted Roots has solid foundational privacy features for living person protection in exports, several gaps exist between the documented roadmap and current implementation.

This document covers:
1. Wiring up existing but unused sensitive field infrastructure
2. User-defined private fields via underscore-prefix convention
3. Deadname protection
4. Manual living status override
5. Export warnings for sensitive data
6. Pronouns field support
7. Privacy-aware canvas generation
8. Improved discoverability of privacy features

---

## Current State

### What's Implemented

| Feature | Status | Location |
|---------|--------|----------|
| Living person detection | ✅ | `privacy-service.ts` |
| Privacy display formats (living, private, initials, hidden) | ✅ | `privacy-service.ts` |
| GEDCOM export privacy | ✅ | `gedcom-exporter.ts` |
| CSV export privacy | ✅ | `csv-exporter.ts` |
| Gramps/GEDCOM X export privacy | ✅ | `gramps-exporter.ts`, `gedcomx-exporter.ts` |
| Log export obfuscation | ✅ | `logging.ts` |
| Gender identity model (sex/gender/gender_identity) | ✅ | Data model |
| Privacy settings UI | ✅ | `settings.ts` |
| Export privacy override UI | ✅ | `export-options-builder.ts` |
| `SENSITIVE_FIELDS` constant | ✅ Defined | `gedcom-types.ts` |

### What's NOT Implemented

| Feature | Status |
|---------|--------|
| Sensitive field redaction (SSN, identity numbers) | ✅ **Complete** — Implicit via `PersonNode` whitelist + explicit utilities |
| Underscore-prefix privacy convention | Not implemented |
| Deadname protection | ✅ **Complete** — `private_fields` + `previous_names` pattern documented |
| `cr_living` manual override | ✅ **Complete** |
| Pronouns field | ✅ **Complete** |
| Canvas obfuscation mode | ✅ **Complete** — Privacy-aware canvas generation in Tree Wizard |
| Export warnings for private fields | ✅ **Complete** — `PrivateFieldsWarningModal` in Export Wizard |
| Privacy feature discoverability | ✅ **Complete** — `PrivacyNoticeModal` after import, export preview warning |

### ~~Key Gap: SENSITIVE_FIELDS Unused~~ ✅ RESOLVED

```typescript
// src/core/privacy-service.ts (centralized location)
export const SENSITIVE_FIELDS = new Set([
    'ssn', 'identityNumber', 'identity_number',
    'socialSecurityNumber', 'social_security_number'
]);
```

~~This constant is defined but has **zero references** in the codebase.~~ **Resolved:** Investigation revealed that exporters use the `PersonNode` interface which doesn't include sensitive fields—providing implicit protection by design. Utilities (`isSensitiveField()`, `filterSensitiveFields()`) were added for future use. The constant was moved to `privacy-service.ts` as the canonical location.

---

## Design Principles

1. **Privacy is opt-in** — Existing behavior unchanged; users must enable privacy features
2. **Warn, don't block** — Show warnings about sensitive data but allow override
3. **Sensitive fields always redacted** — SSN/identity numbers excluded regardless of living status
4. **Convention over configuration** — Underscore prefix is simple and self-documenting
5. **Discoverability** — Users should know privacy features exist before they accidentally share sensitive data

---

## Proposed Implementation

### Phase 1: Sensitive Field Redaction (P1) — [#96](https://github.com/banisterious/obsidian-charted-roots/issues/96)

Wire up the existing `SENSITIVE_FIELDS` constant to all exporters.

**Behavior:**
- Fields in `SENSITIVE_FIELDS` are **always excluded** from exports, regardless of living/deceased status
- This applies to: GEDCOM, GEDCOM X, Gramps XML, CSV exports
- No user toggle — sensitive fields should never be exported

**Implementation:**

1. **Create utility function** in `privacy-service.ts`:
   ```typescript
   export function isSensitiveField(fieldName: string): boolean {
       return SENSITIVE_FIELDS.has(fieldName.toLowerCase());
   }

   export function redactSensitiveFields<T extends Record<string, unknown>>(
       data: T,
       sensitiveFields: Set<string> = SENSITIVE_FIELDS
   ): T {
       const result = { ...data };
       for (const field of sensitiveFields) {
           if (field in result) {
               delete result[field];
           }
       }
       return result;
   }
   ```

2. **Apply in each exporter** before writing person data:
   - `gedcom-exporter.ts` — Filter before generating GEDCOM records
   - `gedcomx-exporter.ts` — Filter before JSON serialization
   - `gramps-exporter.ts` — Filter before XML generation
   - `csv-exporter.ts` — Exclude sensitive columns from output

3. **Add setting for additional sensitive fields**:
   ```typescript
   additionalSensitiveFields: string[];  // Default: []
   ```
   UI: Comma-separated text field in Settings → Privacy

**Files to modify:**
- `src/core/privacy-service.ts` — Add utility functions
- `src/gedcom/gedcom-exporter.ts` — Apply redaction
- `src/gedcomx/gedcomx-exporter.ts` — Apply redaction
- `src/gramps/gramps-exporter.ts` — Apply redaction
- `src/csv/csv-exporter.ts` — Apply redaction
- `src/settings.ts` — Add `additionalSensitiveFields` setting

---

### Phase 2: Manual Living Status Override (P2) — [#97](https://github.com/banisterious/obsidian-charted-roots/issues/97) ✅ COMPLETE

Add `cr_living` frontmatter property to manually override automatic detection.

**Status:** ✅ Implemented

**What was implemented:**
- `cr_living` frontmatter property support (boolean)
- Added to `PersonPrivacyData` interface in `privacy-service.ts`
- `isLikelyLiving()` checks `cr_living` first before automatic detection
- Added to `PersonNode` interface in `family-graph.ts`
- Extracted from frontmatter in `buildPersonNode()`
- Passed to `applyPrivacy()` in all 4 exporters (GEDCOM, GEDCOM X, Gramps XML, CSV)
- Added to `PersonData` interface in `person-note-writer.ts`
- `updatePersonNote()` handles `cr_living` persistence
- Edit Person modal includes "Living status override" dropdown (shown when privacy protection enabled)
- Control Center passes `cr_living` to modal for editing
- Documentation updates (Frontmatter Reference)

**Behavior:**
- `cr_living: true` — Always treat as living, regardless of dates
- `cr_living: false` — Always treat as deceased, regardless of dates
- `cr_living` absent — Use automatic detection (existing behavior)

**Use cases:**
- Person with unknown dates but known to be living
- Person with death date not yet entered but known to be deceased
- Override false positives from automatic detection

**Files modified:**
- `src/core/privacy-service.ts` — Added `cr_living` to interface, updated `isLikelyLiving()`
- `src/core/family-graph.ts` — Added `cr_living` to `PersonNode`, extraction from frontmatter
- `src/core/person-note-writer.ts` — Added `cr_living` to `PersonData`, handled in `updatePersonNote()`
- `src/gedcom/gedcom-exporter.ts` — Pass `cr_living` to `applyPrivacy()`
- `src/gedcomx/gedcomx-exporter.ts` — Pass `cr_living` to `applyPrivacy()`
- `src/gramps/gramps-exporter.ts` — Pass `cr_living` to `applyPrivacy()`
- `src/csv/csv-exporter.ts` — Pass `cr_living` to `applyPrivacy()`
- `src/ui/create-person-modal.ts` — Added "Living status override" dropdown in edit mode
- `src/ui/control-center.ts` — Pass `cr_living` from frontmatter to modal
- `wiki-content/Frontmatter-Reference.md` — Documented `cr_living` property

---

### Phase 3: Explicit Private Fields List (P2) — [#98](https://github.com/banisterious/obsidian-charted-roots/issues/98)

Use an explicit `private_fields` frontmatter property to mark fields as private.

**Why not underscore-prefix convention:**
- Conflicts with existing `_id` suffix pattern (e.g., `father_id`, `spouse1_id`)
- Gramps handle detection already uses underscore-prefix logic
- Explicit list is clearer and avoids ambiguity

**Frontmatter example:**
```yaml
name: Jane Smith
previous_names:
  - Jane Doe
  - Jane Johnson
medical_notes: "Family history of heart disease"
private_fields:
  - previous_names
  - medical_notes
```

**Behavior:**
- Fields listed in `private_fields` array are treated as private
- **Excluded from:** Exports (unless explicitly included), search result previews
- **Included in:** Note content, Edit Person modal, internal processing
- **Export:** Requires confirmation dialog (see Phase 5)

**Implementation:**

1. **Add to PersonNode interface** in `family-graph.ts`:
   ```typescript
   privateFields?: string[];  // Field names marked as private
   ```

2. **Extract from frontmatter** in `buildPersonNode()`:
   ```typescript
   const privateFields = fm.private_fields;
   // Normalize to array
   const privateFieldList = Array.isArray(privateFields)
       ? privateFields
       : privateFields ? [privateFields] : [];
   ```

3. **Create utility functions** in `privacy-service.ts`:
   ```typescript
   export function isPrivateField(fieldName: string, privateFields: string[]): boolean {
       return privateFields.includes(fieldName);
   }

   export function getPrivateFieldValues(
       frontmatter: Record<string, unknown>,
       privateFields: string[]
   ): Record<string, unknown> {
       return Object.fromEntries(
           Object.entries(frontmatter).filter(([key]) => privateFields.includes(key))
       );
   }

   export function filterPrivateFields<T extends Record<string, unknown>>(
       data: T,
       privateFields: string[]
   ): Partial<T> {
       return Object.fromEntries(
           Object.entries(data).filter(([key]) => !privateFields.includes(key))
       ) as Partial<T>;
   }
   ```

4. **Apply in export contexts:**
   - Check `privateFields` before including field values in exports
   - Trigger confirmation dialog if private fields would be exported

**Files to modify:**
- `src/core/family-graph.ts` — Add `privateFields` to `PersonNode`, extract from frontmatter
- `src/core/privacy-service.ts` — Add utility functions
- Exporters — Check private fields before export (Phase 5)

**Documentation:**
- Document `private_fields` property in Frontmatter Reference
- Add examples for common use cases (previous names, medical notes, etc.)

---

### Phase 4: Deadname Protection (P2) — [#99](https://github.com/banisterious/obsidian-charted-roots/issues/99)

Protection for `previous_names` field when marked as private.

**Behavior:**
- When `previous_names` is listed in `private_fields`, it is excluded from exports
- `previous_names` IS shown in:
  - Edit Person modal
  - Full note content
  - Export (only with explicit confirmation)

**Rationale:**
- Previous names may include deadnames (names a person no longer uses)
- Displaying deadnames without consent can cause harm
- Research value preserved in note content
- Explicit `private_fields` list makes intent clear and user-controlled

**Implementation:**
- Covered by Phase 3 (`private_fields` list)
- Document `previous_names` + `private_fields` pattern for this use case
- Add to person schema documentation with examples

**Example:**
```yaml
name: Alex Johnson
previous_names:
  - Alexandra Johnson
  - Alex Smith
private_fields:
  - previous_names
```

---

### Phase 5: Export Warnings for Private Fields (P2) — [#99](https://github.com/banisterious/obsidian-charted-roots/issues/99)

Show confirmation dialog when export would include fields marked as private.

**Behavior:**
1. Before export, scan for people with `private_fields` that have values
2. If found, show confirmation dialog:
   ```
   ⚠️ Export contains private fields

   The following private fields will be included in this export:
   • previous_names (23 people)
   • medical_notes (5 people)

   [Include private fields] [Exclude private fields] [Cancel]
   ```
3. User can proceed with or without private fields

**Implementation:**

1. **Scan for private fields** before export:
   ```typescript
   interface PrivateFieldSummary {
       fieldName: string;
       peopleCount: number;
   }

   function scanForPrivateFields(people: PersonNode[]): PrivateFieldSummary[] {
       const fieldCounts = new Map<string, number>();

       for (const person of people) {
           if (!person.privateFields?.length) continue;
           for (const field of person.privateFields) {
               fieldCounts.set(field, (fieldCounts.get(field) || 0) + 1);
           }
       }

       return Array.from(fieldCounts.entries())
           .map(([fieldName, peopleCount]) => ({ fieldName, peopleCount }))
           .sort((a, b) => b.peopleCount - a.peopleCount);
   }
   ```

2. **Add to export flow** in each exporter:
   ```typescript
   async export(options: ExportOptions): Promise<ExportResult> {
       const privateFieldSummary = scanForPrivateFields(people);
       if (privateFieldSummary.length > 0 && !options.skipPrivateWarning) {
           const decision = await this.showPrivateFieldsWarning(privateFieldSummary);
           if (decision === 'cancel') return { cancelled: true };
           if (decision === 'exclude') {
               // Filter private field values from export data
               people = this.stripPrivateFieldValues(people);
           }
       }
       // Continue with export...
   }
   ```

3. **Create warning modal** `PrivateFieldsWarningModal`

**Files to modify:**
- `src/ui/private-fields-warning-modal.ts` — New file
- `src/core/privacy-service.ts` — Add `scanForPrivateFields()` utility
- `src/gedcom/gedcom-exporter.ts` — Add check
- `src/gedcomx/gedcomx-exporter.ts` — Add check
- `src/gramps/gramps-exporter.ts` — Add check
- `src/csv/csv-exporter.ts` — Add check

---

### Phase 6: Privacy Feature Discoverability (P2) — [#100](https://github.com/banisterious/obsidian-charted-roots/issues/100)

Help users discover privacy features before accidentally sharing sensitive data.

**Approaches:**

1. **First-run notice** (when living persons detected):
   ```
   📋 Privacy Protection Available

   Charted Roots detected X people who may be living.
   Privacy protection can hide or anonymize living persons in exports.

   [Configure Privacy Settings] [Remind Me Later] [Don't Show Again]
   ```
   - Trigger: First import that includes people without death dates
   - Store dismissal in settings: `privacyNoticeDismissed: boolean`

2. **Export dialog warning** (when privacy disabled):
   - Add subtle notice in export dialogs when `enablePrivacyProtection: false`
   - Text: "ℹ️ Privacy protection is disabled. Living persons will be exported with full details."
   - Link to settings

3. **Settings description improvement**:
   - Expand privacy settings descriptions
   - Add "Learn more" link to documentation

**Files to modify:**
- `src/ui/privacy-notice-modal.ts` — New file
- `src/settings.ts` — Add `privacyNoticeDismissed`, improve descriptions
- `src/ui/export-options-builder.ts` — Add privacy disabled notice
- Import wizards — Trigger first-run notice

---

### Phase 7: Pronouns Field (P3) — [#101](https://github.com/banisterious/obsidian-charted-roots/issues/101) ✅ COMPLETE

Add `pronouns` property support for respectful communication.

**Status:** ✅ Implemented

**What was implemented:**
- `pronouns` frontmatter property support (free-form string)
- `showPronouns` setting (default: true)
- Display in person pickers (after name in parentheses)
- Edit Person modal field for pronouns
- Pronouns included in all report generators (10 generators updated)
- PDF report rendering with pronouns (Individual Summary, Family Group Sheet)
- Documentation updates (Frontmatter Reference)

**Files modified:**
- `src/settings.ts` — Added `showPronouns` setting
- `src/core/family-graph.ts` — Extract pronouns from frontmatter
- `src/reports/types/report-types.ts` — Added `pronouns` to `ReportPerson` interface
- `src/reports/services/*-generator.ts` — All 10 generators updated with `pronouns` in `nodeToReportPerson()`
- `src/reports/services/pdf-report-renderer.ts` — Added pronouns to PDF vital statistics
- `src/ui/person-picker-modal.ts` — Display pronouns
- `src/ui/edit-person-modal.ts` — Added pronouns field
- `wiki-content/Frontmatter-Reference.md` — Documented `pronouns` property

---

### Phase 8: Privacy-Aware Canvas Generation (P3) — [#102](https://github.com/banisterious/obsidian-charted-roots/issues/102) ✅ COMPLETE

Add privacy options to canvas tree generation.

**Technical constraint:**
- Obsidian Canvas API has no view manipulation hooks
- Runtime obfuscation is **not feasible**
- Privacy must be applied **at generation time**

**What was implemented:**
- Privacy Options section in Tree Wizard (canvas and Excalidraw)
- Toggle: "Apply privacy protection" (defaults to global setting)
- Format dropdown: "text" (no file link) or "file" (keeps clickable link)
- Living persons shown as text nodes with obfuscated display name
- Text nodes include wikilink for navigation: `**Living**\n\n[[John Smith]]\n\n_Privacy protected_`
- Preview step shows count of privacy-protected persons
- 'hidden' privacy setting excludes living persons from canvas entirely

**Files modified:**
- `src/core/canvas-generator.ts` — Privacy node creation, `createPersonNode()` helper
- `src/trees/ui/unified-tree-wizard-modal.ts` — Privacy UI, living count in preview

#### Known Limitations

Canvas privacy has inherent limitations compared to export privacy:

| Limitation | Explanation |
|------------|-------------|
| **File nodes reveal identity** | The 'file' format still links to the actual person note. The filename (e.g., `John Smith.md`) is visible in the canvas JSON and when hovering. Use 'text' format for stronger protection. |
| **Wikilinks in text nodes** | Text nodes include `[[filename]]` for navigation convenience. This reveals the filename, though not the full path. |
| **Canvas JSON is not encrypted** | The `.canvas` file is plain JSON. Anyone with vault access can read it, including file paths. |
| **No runtime protection** | Privacy is applied at generation time only. If you regenerate a canvas without privacy enabled, all data is exposed. |
| **Shared canvases** | If you share a canvas file (e.g., via git, sync, or export), privacy-protected text nodes still contain wikilinks that reveal filenames. |
| **Edges remain** | Relationship edges to/from privacy-protected nodes are still drawn, which may reveal family structure. |

**Best practice:** For maximum privacy when sharing family trees, use the export formats (GEDCOM, CSV) with privacy enabled, rather than sharing canvas files directly.

---

## Phase Dependencies & Implementation Order

### Independence Matrix

| Phase | Issue | Independent? | Depends On | Effort |
|-------|-------|--------------|------------|--------|
| 1 | #96 Sensitive field redaction | ✅ Yes | — | Low-Medium |
| 2 | #97 `cr_living` override | ✅ Yes | — | Low |
| 3 | #98 Explicit private fields list | ✅ Yes | — | Medium |
| 4-5 | #99 Deadname + Export warnings | ✅ Complete | Phase 3 | Medium-High |
| 6 | #100 Discoverability | ✅ Complete | — | Medium |
| 7 | #101 Pronouns field | ✅ Yes | — | Low |
| 8 | #102 Canvas privacy | ✅ Yes | — | Medium-High |

### Recommended Implementation Order (Quick Wins First)

1. **#101 Pronouns field** — Lowest effort, completely isolated, immediate user value ✅ COMPLETE
2. **#97 `cr_living` override** — Single function change, useful for edge cases ✅ COMPLETE
3. **#96 Sensitive field redaction** — Infrastructure exists, wire to 4 exporters ✅ COMPLETE
4. **#98 Explicit private fields list** — Add `private_fields` support, unlocks #99 ✅ COMPLETE
5. **#99 Deadname + Export warnings** — Depends on #98 ✅ COMPLETE
6. **#100 Discoverability** — New modals, import triggers ✅ COMPLETE
7. **#102 Canvas privacy** — Larger scope, lower priority ✅ COMPLETE

### Dependency Diagram

```
Independent (can start anytime):
  #96 Sensitive Fields ─────────┐
  #97 cr_living Override ───────┤
  #98 Private Fields List ──────┼───► #99 Deadname + Export Warnings
  #100 Discoverability ─────────┤         (depends on #98)
  #101 Pronouns ────────────────┤
  #102 Canvas Privacy ──────────┘
```

---

## Settings Changes

### New Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `additionalSensitiveFields` | `string[]` | `[]` | Additional field names to always redact from exports |
| `privacyNoticeDismissed` | `boolean` | `false` | Whether user has dismissed first-run privacy notice |
| `showPronouns` | `boolean` | `true` | Show pronouns in person picker and displays |

### Existing Settings (No Changes)

| Setting | Default | Notes |
|---------|---------|-------|
| `enablePrivacyProtection` | `false` | Remains opt-in |
| `livingPersonAgeThreshold` | `100` | No change |
| `privacyDisplayFormat` | `'living'` | No change |
| `hideDetailsForLiving` | `false` | No change |

---

## Documentation Updates

1. **Privacy-And-Security.md** — Add sections for:
   - Sensitive field redaction
   - `cr_living` override
   - `private_fields` list
   - Deadname protection
   - Pronouns field

2. **Person-Notes.md** — Document new properties:
   - `cr_living`
   - `pronouns`
   - `private_fields`
   - `previous_names`

3. **Import-Export.md** — Add:
   - Sensitive field handling
   - Private field export warnings

4. **Roadmap.md** — Update status when implemented

---

## Implementation Checklist

### Phase 1: Sensitive Field Redaction ✅
- [x] Add `isSensitiveField()` and `filterSensitiveFields()` to privacy-service.ts
- [x] ~~Apply redaction in gedcom-exporter.ts~~ Not needed — `PersonNode` whitelist provides implicit protection
- [x] ~~Apply redaction in gedcomx-exporter.ts~~ Not needed — `PersonNode` whitelist provides implicit protection
- [x] ~~Apply redaction in gramps-exporter.ts~~ Not needed — `PersonNode` whitelist provides implicit protection
- [x] ~~Apply redaction in csv-exporter.ts~~ Not needed — `CsvColumn` enum provides implicit protection
- [ ] ~~Add `additionalSensitiveFields` setting~~ Deferred — can be added if users request it
- [ ] ~~Add tests for sensitive field redaction~~ Not needed — architectural protection via `PersonNode`

**Note:** Investigation revealed that all exporters work with the `PersonNode` interface, which doesn't include `ssn` or `identityNumber` fields. This provides implicit protection by design. The utilities were added for future use if raw frontmatter access is needed.

### Phase 2: Manual Living Override ✅
- [x] Update `PrivacyService.isLikelyLiving()` to check `cr_living` first
- [x] Add `cr_living` to `PersonPrivacyData` and `PersonNode` interfaces
- [x] Extract `cr_living` from frontmatter in `buildPersonNode()`
- [x] Pass `cr_living` to `applyPrivacy()` in all 4 exporters
- [x] Document `cr_living` property in Frontmatter Reference
- [x] Add toggle to Edit Person modal (shown when privacy protection enabled)

### Phase 3: Explicit Private Fields List ✅
- [x] Add `privateFields` to `PersonNode` interface in `family-graph.ts`
- [x] Extract `private_fields` from frontmatter in `buildPersonNode()`
- [x] Add utility functions to `privacy-service.ts`:
  - [x] `isPrivateField(fieldName, privateFields)`
  - [x] `getPrivateFieldValues(frontmatter, privateFields)`
  - [x] `filterPrivateFields(data, privateFields)`
- [x] Document `private_fields` property in Frontmatter Reference

### Phase 4: Deadname Protection ✅
- [x] Document `previous_names` + `private_fields` pattern for deadname protection
- [x] Add example to Frontmatter Reference
- [x] Verify Phase 3 implementation handles this use case

### Phase 5: Export Warnings ✅
- [x] Add `scanForPrivateFields()` utility to `privacy-service.ts`
- [x] Create `PrivateFieldsWarningModal`
- [x] Add private field check to Export Wizard (covers all formats via single integration point)
  - GEDCOM, GEDCOM X, Gramps, and CSV all use the Export Wizard modal
  - Warning shown in Step 4 (Preview) before export runs
  - User can choose: Include private fields, Exclude private fields, or Cancel

### Phase 6: Discoverability ✅
- [x] Create privacy notice modal (`PrivacyNoticeModal`)
- [x] Add `privacyNoticeDismissed` setting
- [x] Trigger notice on first import with living persons (in `renderStep7Complete`)
- [x] Add privacy disabled notice to export dialogs (in `renderStep4Preview`)
- [ ] Improve settings descriptions (deferred)

### Phase 7: Pronouns Field ✅
- [x] Add `showPronouns` setting
- [x] Display pronouns in PersonPickerModal
- [x] Add pronouns field to Edit Person modal
- [x] Include pronouns in relevant reports
- [x] Document pronouns property

### Phase 8: Canvas Privacy ✅ COMPLETE
- [x] Add privacy options to CanvasGenerationOptions
- [x] Implement privacy logic in canvas-generator.ts
- [x] Add privacy section to tree generation modal UI
- [x] Document canvas privacy limitations

---

## References

- [Roadmap Entry](../../wiki-content/Roadmap.md#export-privacy--sensitive-data)
- [SECURITY.md](../../SECURITY.md)
- [Privacy-And-Security.md](../../wiki-content/Privacy-And-Security.md)
- [Specialized Features - Privacy](../developer/implementation/specialized-features.md#privacy-and-gender-identity-protection)
