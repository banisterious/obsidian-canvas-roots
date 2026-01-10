# ESLint Sentence Case Review

This document lists all `obsidianmd/ui/sentence-case` warnings for manual review.

**Total flagged items:** 292

## Table of Contents

- [Summary by Category](#summary-by-category)
- [Category: add-button](#category-add-button)
- [Category: aria-attribute](#category-aria-attribute)
- [Category: error-message](#category-error-message)
- [Category: example-text](#category-example-text)
- [Category: html-tag](#category-html-tag)
- [Category: identifier](#category-identifier)
- [Category: navigation](#category-navigation)
- [Category: sentence-start](#category-sentence-start)
- [Category: separator](#category-separator)
- [Category: title-case](#category-title-case)
- [Category: unknown](#category-unknown)

---

## Summary by Category

| Category | Count | Notes |
|----------|-------|-------|
| unknown | 66 | Review needed - Uncategorized |
| example-text | 64 | Correct - Example placeholders |
| html-tag | 38 | False positive - HTML element names |
| identifier | 34 | Likely false positive - Code identifiers |
| sentence-start | 33 | Likely false positive - Valid sentence starting with capital |
| title-case | 17 | Review needed - May be proper noun or Title Case to fix |
| separator | 16 | False positive - Separator characters |
| navigation | 16 | Correct - Navigation symbols |
| error-message | 5 | Correct - Error/Warning prefix is intentional |
| aria-attribute | 2 | False positive - ARIA attributes |
| add-button | 1 | Correct - "+ Add" button pattern |

## Category: add-button

**Correct - "+ Add" button pattern**

### src/dates/ui/date-systems-card.ts

- Line 499: `+ Add era`

## Category: aria-attribute

**False positive - ARIA attributes**

### src/dynamic-content/renderers/relationships-renderer.ts

- Line 101: `aria-label`

### src/dynamic-content/renderers/timeline-renderer.ts

- Line 89: `aria-label`

## Category: error-message

**Correct - Error/Warning prefix is intentional**

### src/core/relationship-manager.ts

- Line 67: `Error: could not find cr_id in one or both notes`
- Line 73: `Warning: selected person has sex: F but being added as fathe...`
- Line 75: `Warning: selected person has sex: M but being added as mothe...`
- Line 111: `Error: could not find cr_id in one or both notes`
- Line 147: `Error: could not find cr_id in one or both notes`

## Category: example-text

**Correct - Example placeholders**

### src/events/ui/create-event-modal.ts

- Line 128: `e.g., Birth of John Smith`
- Line 160: `e.g., 1888-05-15 or 3019 T.A.`
- Line 171: `e.g., 1895-12-31`
- Line 235: `e.g., [[London, England]]`
- Line 246: `e.g., [[Smith Family Timeline]]`
- Line 301: `e.g., Middle-earth`

### src/events/ui/event-type-editor-modal.ts

- Line 141: `e.g., Coronation`
- Line 168: `e.g., Royal coronation ceremony`

### src/maps/ui/enrich-place-hierarchy-modal.ts

- Line 188: `e.g., Places`

### src/organizations/ui/add-membership-modal.ts

- Line 100: `e.g., Lord, Member, Captain`
- Line 109: `e.g., 283 AC, TA 2941`
- Line 118: `e.g., 298 AC`

### src/organizations/ui/create-organization-modal.ts

- Line 85: `e.g., House Stark`
- Line 115: `e.g., westeros`
- Line 128: `e.g., Age of Heroes, TA 2000`
- Line 137: `e.g., Winter is Coming`

### src/organizations/ui/organization-type-editor-modal.ts

- Line 140: `e.g., Secret society`
- Line 167: `e.g., Clandestine organizations with hidden membership`

### src/places/ui/place-type-editor-modal.ts

- Line 105: `e.g., Township`
- Line 131: `e.g., Administrative subdivision`

### src/relationships/ui/relationship-type-editor-modal.ts

- Line 138: `e.g., Blood brother`
- Line 165: `e.g., Sworn brothers bound by oath`

### src/sources/ui/create-proof-modal.ts

- Line 129: `e.g., Birth date of John Smith`

### src/sources/ui/create-source-modal.ts

- Line 161: `e.g., 1900 US Census - Smith Family`
- Line 192: `e.g., 1900-06-01`
- Line 201: `e.g., Ancestry.com, FamilySearch, National Archives`
- Line 227: `e.g., 2024-03-15`
- Line 245: `e.g., 1900 United States Federal Census`
- Line 257: `e.g., New York, Kings County, Brooklyn`

### src/sources/ui/custom-source-type-modal.ts

- Line 115: `e.g., Family Bible`
- Line 140: `e.g., Family records in Bibles`

### src/sources/ui/source-type-editor-modal.ts

- Line 141: `e.g., Tax record`
- Line 168: `e.g., Property and income tax records`

### src/ui/add-relationship-modal.ts

- Line 109: `e.g., `

### src/ui/control-center.ts

- Line 3875: `e.g., London, England`

### src/ui/create-map-modal.ts

- Line 203: `e.g., Middle-earth, Westeros`
- Line 223: `e.g., middle-earth`
- Line 244: `e.g., tolkien, westeros, star-wars`
- Line 347: `e.g., 2048`
- Line 356: `e.g., 1536`
- Line 379: `e.g., Maps`

### src/ui/create-missing-places-modal.ts

- Line 91: `e.g., Places`

### src/ui/create-person-modal.ts

- Line 203: `e.g., John Robert Smith`
- Line 228: `e.g., 1888-05-15`
- Line 239: `e.g., 1952-08-20`
- Line 250: `e.g., London, England`
- Line 261: `e.g., New York, USA`
- Line 348: `e.g., Smith Family`
- Line 408: `e.g., westeros, middle-earth`
- Line 422: `e.g., People`

### src/ui/create-place-modal.ts

- Line 398: `e.g., London`
- Line 515: `e.g., Middle-earth, A Song of Ice and Fire`
- Line 578: `e.g., England or [[England]]`
- Line 591: `e.g., England or [[England]]`
- Line 605: `e.g., City of London, Londinium`
- Line 666: `e.g., Smith Family`
- Line 734: `e.g., Places`

### src/ui/create-schema-modal.ts

- Line 181: `e.g., House Stark Schema`
- Line 201: `e.g., schema-house-stark`
- Line 220: `e.g., Validates members of House Stark...`
- Line 344: `e.g., allegiance`
- Line 465: `e.g., male, female, other`
- Line 600: `e.g., !died || born`
- Line 610: `e.g., Cannot have death date without birth date`

## Category: html-tag

**False positive - HTML element names**

### src/relationships/ui/relationship-type-manager-card.ts

- Line 273: `span`

### src/settings.ts

- Line 526: `strong`

### src/statistics/ui/statistics-tab.ts

- Line 211: `a`

### src/statistics/ui/statistics-view.ts

- Line 112: `h1`

### src/ui/control-center.ts

- Line 642: `strong`
- Line 5106: `strong`
- Line 8738: `a`
- Line 11722: `strong`
- Line 14487: `li`
- Line 14489: `li`
- Line 14490: `li`
- Line 14729: `li`
- Line 14730: `li`
- Line 14731: `li`
- Line 14732: `li`
- Line 14733: `li`
- Line 14950: `li`
- Line 14951: `li`
- Line 14952: `li`
- Line 15208: `li`
- Line 16150: `div`

### src/ui/create-schema-modal.ts

- Line 558: `li`
- Line 559: `li`

### src/ui/export-options-builder.ts

- Line 390: `div`
- Line 396: `div`

### src/ui/places-tab.ts

- Line 632: `p`
- Line 1430: `th`
- Line 1431: `th`

### src/ui/standardize-place-types-modal.ts

- Line 112: `li`
- Line 113: `li`
- Line 114: `li`

### src/ui/standardize-places-modal.ts

- Line 92: `li`
- Line 93: `li`
- Line 94: `li`
- Line 95: `li`

### src/ui/views/family-chart-view.ts

- Line 674: `li`
- Line 675: `li`
- Line 808: `h3`

## Category: identifier

**Likely false positive - Code identifiers**

### src/dates/ui/date-systems-card.ts

- Line 472: `middle_earth`
- Line 484: `middle-earth`

### src/events/ui/event-type-editor-modal.ts

- Line 158: `coronation`

### src/organizations/ui/organization-type-editor-modal.ts

- Line 157: `secret_society`

### src/organizations/ui/organizations-tab.ts

- Line 154: `option`
- Line 155: `option`

### src/places/ui/place-type-editor-modal.ts

- Line 121: `township`

### src/relationships/ui/relationship-type-editor-modal.ts

- Line 155: `blood_brother`

### src/settings.ts

- Line 569: `cr_type`
- Line 570: `type`
- Line 654: `living`
- Line 655: `private`

### src/sources/ui/create-source-modal.ts

- Line 210: `high`
- Line 211: `medium`
- Line 212: `low`
- Line 213: `unknown`

### src/sources/ui/custom-source-type-modal.ts

- Line 130: `family_bible`

### src/sources/ui/source-type-editor-modal.ts

- Line 158: `tax_record`

### src/sources/ui/sources-tab.ts

- Line 270: `option`
- Line 271: `option`

### src/ui/control-center.ts

- Line 1391: `title`
- Line 5207: `original`

### src/ui/create-place-modal.ts

- Line 782: `option`
- Line 783: `option`

### src/ui/export-options-builder.ts

- Line 559: `exports`

### src/ui/merge-duplicate-places-modal.ts

- Line 524: `suggested`

### src/ui/preferences-tab.ts

- Line 1006: `date-location`
- Line 1007: `full`
- Line 1056: `iso8601`
- Line 1057: `gedcom`
- Line 1138: `standard`

### src/ui/relationship-history-modal.ts

- Line 179: `auto-sync`
- Line 186: `undone`

### src/ui/split-wizard-modal.ts

- Line 936: `family-tree`

## Category: navigation

**Correct - Navigation symbols**

### src/enhancement/ui/place-generator-modal.ts

- Line 362: `A→Z`
- Line 511: `← Prev`
- Line 866: `A→Z`
- Line 985: `← Prev`

### src/reports/ui/report-generator-modal.ts

- Line 178: `Folder to save report (configured in Preferences → Folder lo...`

### src/settings.ts

- Line 530: `Control Center → Preferences`

### src/ui/add-person-type-modal.ts

- Line 65: `A→Z`

### src/ui/control-center.ts

- Line 1277: `Read the full Getting Started guide →`
- Line 14283: `A→Z`
- Line 14528: `A→Z`
- Line 14757: `A→Z`
- Line 15250: `A→Z`
- Line 15543: `A→Z`
- Line 15831: `A→Z`
- Line 16202: `← Previous`

### src/ui/merge-duplicate-places-modal.ts

- Line 127: `(check Settings → Files and links → Deleted files to ensure ...`

## Category: sentence-start

**Likely false positive - Valid sentence starting with capital**

### src/dates/ui/events-tab.ts

- Line 99: `Create an Obsidian base for managing Event notes. After crea...`

### src/enhancement/ui/place-generator-modal.ts

- Line 204: `Create parent places (e.g., `
- Line 247: `Click `

### src/events/ui/create-event-modal.ts

- Line 403: `Click `

### src/maps/map-view.ts

- Line 504: `Export as GeoJSON overlay`

### src/maps/ui/bulk-geocode-modal.ts

- Line 86: `This will use OpenStreetMap\`

### src/organizations/ui/organizations-tab.ts

- Line 449: `Create a ready-to-use Obsidian Bases template for managing o...`

### src/sources/ui/sources-tab.ts

- Line 179: `Create an Obsidian base for managing Source notes. After cre...`

### src/statistics/ui/statistics-view.ts

- Line 1603: `Add person notes with cr_id property to see statistics.`

### src/ui/add-person-type-modal.ts

- Line 36: `Preview: Add cr_type property to person notes`

### src/ui/control-center.ts

- Line 364: `This note does not have a cr_id field`
- Line 595: `Generate all trees - Results`
- Line 1703: `Use the Templater plugin to create notes with consistent for...`
- Line 1865: `Create an Obsidian base for managing People notes. After cre...`
- Line 2881: `Export timeline to Canvas`
- Line 2920: `Export timeline to Canvas`
- Line 5182: `Add timeline and family relationship blocks to person notes ...`
- Line 9551: `This file does not appear to be a valid Gramps XML file. If ...`
- Line 12310: `Create an Obsidian Base for managing your data in table view`
- Line 14245: `Preview: Remove duplicate relationships`
- Line 14479: `Preview: Remove placeholder values`
- Line 14721: `Preview: Normalize name formatting`
- Line 14942: `Preview: Remove orphaned cr_id references`
- Line 14947: `This operation removes broken relationship references (cr_id...`
- Line 15198: `Preview: Fix bidirectional relationship inconsistencies`
- Line 15480: `Preview: Impossible date issues`
- Line 16368: `Preview: Date format validation issues`

### src/ui/create-place-modal.ts

- Line 618: `User-defined grouping (e.g., `

### src/ui/export-options-builder.ts

- Line 445: `Export custom relationships (godparent, witness, guardian, e...`

### src/ui/flatten-nested-properties-modal.ts

- Line 287: `Click `

### src/ui/folder-scan-modal.ts

- Line 100: `This folder does not contain any person notes with cr_id fie...`

### src/ui/places-tab.ts

- Line 70: `Create an Obsidian base for managing Place notes. After crea...`
- Line 1414: `Preview: Normalize place name formatting`

## Category: separator

**False positive - Separator characters**

### src/dates/ui/date-systems-card.ts

- Line 520: `, `

### src/events/ui/timeline-style-modal.ts

- Line 235: `, `

### src/organizations/ui/add-membership-modal.ts

- Line 86: `, `

### src/ui/build-place-hierarchy-modal.ts

- Line 148: `, `

### src/ui/canvas-style-modal.ts

- Line 74: `, `
- Line 91: `, `
- Line 107: `, `
- Line 123: `, `
- Line 143: `, `
- Line 163: `, `
- Line 178: `, `

### src/ui/create-person-modal.ts

- Line 214: `, `
- Line 307: `, `
- Line 367: `, `

### src/ui/create-place-modal.ts

- Line 432: `, `
- Line 626: `, `

## Category: title-case

**Review needed - May be proper noun or Title Case to fix**

### src/dates/ui/events-tab.ts

- Line 98: `Create Events base`
- Line 726: `Event Timeline`

### src/events/ui/extract-events-modal.ts

- Line 320: `Click Link to select`

### src/organizations/ui/create-organization-modal.ts

- Line 156: `Charted Roots/Organizations`

### src/reports/ui/report-generator-modal.ts

- Line 180: `Charted Roots/Reports`

### src/settings.ts

- Line 779: `Replace PII with placeholders when exporting logs`

### src/sources/ui/source-image-wizard.ts

- Line 231: `Charted Roots/Sources/Media`
- Line 743: `Charted Roots/Sources`

### src/sources/ui/source-media-linker.ts

- Line 241: `Charted Roots/Sources/Media`

### src/sources/ui/sources-tab.ts

- Line 178: `Create Sources base`

### src/ui/control-center.ts

- Line 1251: `Charted Roots generates family trees on the Obsidian Canvas f...`
- Line 1312: `Open Data Quality`
- Line 1864: `Create People base`
- Line 1889: `Data Quality tab`
- Line 12294: `Create Obsidian Bases to view and manage your data in spread...`

### src/ui/places-tab.ts

- Line 69: `Create Places base`
- Line 155: `Data Quality tab`

## Category: unknown

**Review needed - Uncategorized**

### src/dates/ui/date-systems-card.ts

- Line 456: `Middle-earth Calendar`

### src/dynamic-content/services/dynamic-content-service.ts

- Line 340: `Block frozen to markdown`

### src/events/ui/create-event-modal.ts

- Line 158: `Event date (YYYY-MM-DD format or fictional calendar format)`

### src/events/ui/extract-events-modal.ts

- Line 306: `YYYY-MM-DD`
- Line 372: `[[Place Name]]`

### src/maps/map-view.ts

- Line 1083: `── Custom maps ──`

### src/organizations/ui/create-organization-modal.ts

- Line 106: `[[Parent Org]]`
- Line 113: `Optional universe scope (e.g., westeros, middle-earth)`
- Line 146: `[[Winterfell]]`

### src/settings.ts

- Line 555: `Auto-generate cr_id`
- Line 556: `Automatically generate cr_id for person notes that don\`
- Line 846: `People-Staging`

### src/sources/ui/create-proof-modal.ts

- Line 139: `[[Person Name]]`

### src/sources/ui/create-source-modal.ts

- Line 236: `https://...`

### src/sources/ui/source-image-wizard.ts

- Line 277: `Skip .doc, .pdf, .txt and other non-image files`

### src/ui/add-relationship-modal.ts

- Line 42: `Source person does not have a cr_id`
- Line 153: `Both people must have cr_id fields`

### src/ui/control-center.ts

- Line 419: `Only one family tree found. Use `
- Line 1465: `Schema definition goes in a json schema code block in the no...`
- Line 1916: `Clean up placeholder text like `
- Line 1947: `Standardize name capitalization: `
- Line 2075: `Person notes require a cr_id property in their frontmatter. ...`
- Line 2165: `Conflicts occur when multiple people list the same child in ...`
- Line 2409: `No person notes found. Create person notes with a cr_id in f...`
- Line 3675: `⚠️ Name is required`
- Line 3683: `⚠️ Invalid cr_id format. Expected: abc-123-def-456`
- Line 6122: `No collections yet. Right-click a person note and select `
- Line 7204: `✓ Validation passed! No schema violations found.`
- Line 8712: `People-Staging`
- Line 10275: `⚠ No `
- Line 11752: `Only one family tree detected. Use the `
- Line 12173: `These operations work across people, places, events, and sou...`
- Line 12180: `Convert dates to standard YYYY-MM-DD format`
- Line 12196: `Standardize to M/F format. Uses biological sex to match hist...`
- Line 13689: `No orphaned cr_id references found`
- Line 13711: `Removing orphaned cr_id references...`
- Line 13829: `No orphaned cr_id references found`
- Line 14077: `✓ All dates are valid according to your validation settings`
- Line 14954: `Note: Only the _id fields are cleaned. Wikilink references (...`
- Line 15758: `Genealogical records use biological sex (M/F) rather than ge...`
- Line 15926: `✓ Changes applied`
- Line 16459: `Date validation is preview-only. Click `

### src/ui/create-map-modal.ts

- Line 274: `Geographic uses lat/lng coordinates; Pixel uses image coordi...`

### src/ui/create-person-modal.ts

- Line 226: `Date of birth (YYYY-MM-DD format recommended)`
- Line 308: `__custom__`
- Line 368: `__custom__`

### src/ui/create-place-modal.ts

- Line 525: `The parent location in the hierarchy (e.g., England for Lond...`
- Line 627: `__custom__`

### src/ui/duplicate-detection-modal.ts

- Line 133: `Configure options above and click `

### src/ui/export-options-builder.ts

- Line 348: `⚠ No people will be exported with current filters`

### src/ui/folder-scan-modal.ts

- Line 132: `person notes`
- Line 142: `with issues`
- Line 152: `total issues`

### src/ui/gedcom-quality-preview-modal.ts

- Line 168: `✓ No issues found`

### src/ui/merge-duplicate-places-modal.ts

- Line 499: `📍 Coords`
- Line 551: `custom props`

### src/ui/places-tab.ts

- Line 246: `issues found`

### src/ui/preferences-tab.ts

- Line 350: `your value`
- Line 665: `These folders determine where new notes are created during i...`
- Line 835: `Changes apply to new tree generations. To update existing ca...`
- Line 1002: `How to display marriage information on spouse edges (only ap...`
- Line 1041: `Fictional date systems are defined in the Events tab`
- Line 1130: `Controls how the `

### src/ui/standardize-places-modal.ts

- Line 199: `has place note`
- Line 404: `✓ All references already use this name`

### src/ui/views/family-chart-view.ts

- Line 686: `Tip: Person notes need a cr_id property to appear in the cha...`

