# Community Use Cases

Real-world examples of how people use Canvas Roots for genealogy, worldbuilding, and research.

---

## Table of Contents

**Genealogists**
- [Importing from Genealogy Software](#importing-from-genealogy-software)
- [Building a Family Tree from Scratch](#building-a-family-tree-from-scratch)
- [Generating a Family Reunion Report](#generating-a-family-reunion-report)
- [Visualizing Migration Patterns](#visualizing-migration-patterns)
- [Tracking DNA Matches](#tracking-dna-matches)
- [Exporting to Share with Family](#exporting-to-share-with-family)
- [Using Bases for Data Views](#using-bases-for-data-views)

**Worldbuilders**
- [Managing a Fantasy Novel's Character Web](#managing-a-fantasy-novels-character-web)
- [TTRPG Campaign Dynasty](#ttrpg-campaign-dynasty)

**Historians**
- [Researching a Historical Figure](#researching-a-historical-figure)
- [Documenting a Local Cemetery](#documenting-a-local-cemetery)

[Share Your Story](#share-your-story)

---

## By User Type

### Genealogists

Family history researchers tracking ancestors, documenting sources, and visualizing lineages.

- [Case studies listed below](#community-examples)

### Worldbuilders

Fiction writers, game designers, and RPG enthusiasts managing characters, dynasties, and fictional histories.

- [Case studies listed below](#community-examples)

### Historians

Academic researchers and history enthusiasts documenting historical figures and their relationships.

- [Case studies listed below](#community-examples)

---

## Community Examples

### Importing from Genealogy Software

**User type:** Genealogist
**Features used:** GEDCOM Import, Gramps Import, Cleanup Wizard
**Complexity:** Beginner

**The Challenge**

A user new to Canvas Roots wants to migrate existing genealogy data from another application (GEDCOM, Gramps, or CSV) and maintain it exclusively in Obsidian going forward.

**The Approach**

1. Open Control Center and click **Import/Export**
2. Select the file to import (GEDCOM, .gramps, or .gpkg)
3. Configure import options (target folders, what to include)
4. Click **Import** and review the results
5. Run the **Cleanup Wizard** to resolve any data quality issues

**Tips**

- **Trial and error is fine:** If the import doesn't look right, delete the Canvas Roots folder and try again with different options. Deleting from the file system is faster for large imports.
- **Media files:** When importing a Gramps package (.gpkg), you can avoid duplicating media by deleting the imported `Canvas Roots/Media` folder and creating a symbolic link to your original Gramps media folder instead.

---

### Building a Family Tree from Scratch

**User type:** Genealogist
**Features used:** Create Person, Edit Person, Relationship Linking
**Complexity:** Beginner

**The Challenge**

A user new to Canvas Roots wants to build their family tree from scratch without importing existing data. They prefer to establish the people and relationships first, then fill in details like events, places, and sources later.

**The Approach**

1. Open **Control Center** and select **People** from the left navigation
2. Click **Create Person**
3. Enter the person's full name, sex, and birth/death dates (if known)
4. Click **Create Person**
5. Repeat to create additional family members
6. To establish relationships, scroll to the **Person Notes** section at the bottom of the People screen
7. Click on a person to open the **Edit Person** screen
8. Scroll to the relationship fields (Father, Mother, Spouse) and click **Link**
9. Select the related person from the picker
10. Click **Save Changes**
11. Repeat for additional relationships

**Tips**

- **Relationships first, details later:** This workflow lets you quickly sketch out your family structure. You can add events, places, sources, and other details to each person later.
- **Bidirectional linking:** When you set Person 2's father as Person 1, Canvas Roots automatically adds Person 2 to Person 1's children list.

---

### Generating a Family Reunion Report

**User type:** Genealogist
**Features used:** Report Wizard, PDF/ODT Export
**Complexity:** Beginner

**The Challenge**

You're preparing for a family reunion and want to create a printed document showing the family tree, key dates, and biographical information to share with relatives who aren't tech-savvy.

**The Approach**

1. Open **Control Center** and navigate to **Reports**
2. Click **Generate Report** to open the Report Wizard
3. Select a report type (e.g., Descendant Report, Ancestor Report)
4. Choose a starting person (the common ancestor or yourself)
5. Configure options: number of generations, what to include
6. Select output format: **PDF** for printing or **ODT** for editing in Word/LibreOffice
7. Generate and download the report

**Tips**

- **Preview first:** Use the preview option to check the layout before generating the final document.
- **Save presets:** If you generate reports regularly, save your configuration as a preset for quick access.
- **ODT for customization:** Export to ODT if you want to add a custom cover page, photos, or additional text before printing.

---

### Visualizing Migration Patterns

**User type:** Genealogist
**Features used:** Map View, Place Notes, Geolocate Places
**Complexity:** Intermediate

**The Challenge**

You want to understand where your ancestors lived over time and visualize the migration patterns across generations—from the old country to their eventual settlement.

**The Approach**

1. Ensure your person notes have place information in birth, death, and residence fields
2. Open **Control Center** and navigate to **Places**
3. Click **Geolocate Places** to automatically add coordinates to place notes
4. Open **Map View** from the ribbon or command palette
5. Filter by person, date range, or event type to focus your view
6. Observe clusters and movement patterns across the map

**Tips**

- **Standardize place names:** Run the Cleanup Wizard's place standardization to ensure consistent naming (e.g., "New York, NY, USA" vs "New York City").
- **Add residence events:** Birth and death locations only show two points. Add residence events to see the full journey.
- **Use date filtering:** Filter the map by date range to see migration over specific time periods.

---

### Tracking DNA Matches

**User type:** Genealogist
**Features used:** Person Notes, Custom Properties, Wikilinks
**Complexity:** Intermediate

**The Challenge**

You've received DNA match results and want to track potential relatives, document shared DNA amounts, and connect matches to your existing tree as you confirm relationships.

**The Approach**

1. Create a person note for each significant DNA match
2. Add custom frontmatter properties for DNA-specific data:
   ```yaml
   dna_match_cm: 850
   dna_match_service: AncestryDNA
   dna_match_status: confirmed  # or: speculative, researching
   ```
3. Use the notes section to document your research and hypotheses
4. Once a relationship is confirmed, link the match to their place in your tree using relationship fields
5. Use Obsidian's search or Bases to filter and view all DNA matches

**Tips**

- **Start with high matches:** Focus on matches over 100 cM first—these are more likely to be identifiable relatives.
- **Document everything:** Use the note body to record your reasoning, shared matches, and correspondence.
- **Speculative links:** You can add speculative relationships and mark them with a custom `relationship_confidence: speculative` property.

---

### Managing a Fantasy Novel's Character Web

**User type:** Worldbuilder
**Features used:** Universes, Fictional Calendars, Canvas Trees, Create Person
**Complexity:** Intermediate

**The Challenge**

You're writing a fantasy novel with multiple noble houses, complex alliances, and a non-Gregorian calendar. You need to track character relationships, ages, and events in a way that makes sense for your fictional world.

**The Approach**

1. Create a **Universe** for your fictional world via Control Center → Universes
2. Set up a **Fictional Calendar** if your world uses non-standard dating (e.g., "Year of the Dragon 342")
3. Create person notes for each character, assigning them to your universe
4. Establish family relationships between characters (parents, spouses, children)
5. Create **Events** for key story moments (battles, coronations, marriages)
6. Generate a **Canvas Tree** to visualize house lineages
7. Use the **Family Chart** view for an interactive visualization

**Tips**

- **Universe isolation:** Assign all characters to your universe to keep them separate from any real genealogy data.
- **Character templates:** Create a template with common fields (house, title, allegiance) for faster character creation.
- **Timeline view:** Use the dynamic timeline block to see a character's life events in chronological order.

---

### TTRPG Campaign Dynasty

**User type:** Worldbuilder
**Features used:** Universes, Canvas Trees, Relationship Types, Events
**Complexity:** Intermediate

**The Challenge**

You're running a tabletop RPG campaign with a complex political landscape. Players interact with noble families, and you need to track NPCs, their relationships, succession lines, and major historical events.

**The Approach**

1. Create a **Universe** for your campaign setting
2. Create person notes for major NPCs, including nobles, rivals, and allies
3. Use relationship fields to establish family ties and political alliances
4. Create **Events** for major historical moments (wars, coups, treaties)
5. Generate **Canvas Trees** for each major house to use as quick reference during sessions
6. Export trees as images to share with players or include in session notes

**Tips**

- **Session prep:** Before each session, open the Family Chart for relevant houses to refresh your memory.
- **Player characters:** Create person notes for PCs and link them to NPCs they've formed relationships with.
- **Quick reference:** Pin a canvas tree to your workspace for instant access during play.
- **Secrets:** Use the note body to track information players don't know yet.

---

### Researching a Historical Figure

**User type:** Historian
**Features used:** Person Notes, Source Notes, Evidence Tracking, Wikilinks
**Complexity:** Intermediate

**The Challenge**

You're researching a historical figure (a local notable, a distant ancestor, or a public figure) and want to document their life, relationships, and the sources that support your findings.

**The Approach**

1. Create a **Person Note** for your subject with known biographical details
2. Create **Source Notes** for each primary and secondary source you consult
3. Link sources to the person using the sources field or inline citations
4. Create person notes for related individuals (family, colleagues, rivals)
5. Establish relationships between all individuals
6. Use the note body for narrative biographical content
7. Generate a canvas tree to visualize the subject's social/family network

**Tips**

- **Source everything:** Historical research requires citations. Use source notes liberally and link them to specific claims.
- **Distinguish fact from inference:** Use the note body to clearly separate documented facts from your interpretations.
- **Contextual relationships:** Create person notes for contemporaries even if you have limited information—they provide context.

---

### Documenting a Local Cemetery

**User type:** Historian
**Features used:** Place Notes, Person Notes, Events, Map View
**Complexity:** Intermediate

**The Challenge**

You're documenting burials at a local cemetery for historical preservation or personal research. You want to record who is buried there, their relationships, and visualize the data geographically.

**The Approach**

1. Create a **Place Note** for the cemetery with its location and coordinates
2. Create **Person Notes** for each individual buried there
3. Add death events with the cemetery as the location
4. Link family members to show relationships between those buried together
5. Use **Map View** to see all burials geographically
6. Optionally, add custom properties for plot numbers, headstone conditions, or inscriptions

**Tips**

- **Batch creation:** If transcribing from a published burial list, consider importing via CSV or creating notes in bulk.
- **Photos:** Add headstone photos to person notes using the media field.
- **Plot mapping:** Use custom properties like `cemetery_section` and `plot_number` for detailed organization.

---

### Exporting to Share with Family

**User type:** Genealogist
**Features used:** GEDCOM Export, Export Wizard
**Complexity:** Beginner

**The Challenge**

A relative uses different genealogy software (Ancestry, FamilySearch, etc.) and wants a copy of your research. You need to export your Canvas Roots data in a format they can import.

**The Approach**

1. Open **Control Center** and click **Import/Export**
2. Select the **Export** tab
3. Choose **GEDCOM** as the export format
4. Select which people to include (all, or a specific branch)
5. Configure options (include notes, sources, etc.)
6. Click **Export** and save the .ged file
7. Send the file to your relative

**Tips**

- **Test the export:** Import your own GEDCOM into a free tool like Gramps to verify it looks correct before sharing.
- **Privacy:** Review the export for sensitive information (SSNs, living persons' details) before sharing.
- **Subset exports:** If you only want to share one branch, use the person filter to limit the export scope.

---

### Using Bases for Data Views

**User type:** Genealogist
**Features used:** Obsidian Bases, Base Templates
**Complexity:** Advanced

**The Challenge**

You have hundreds of person notes and want to filter, sort, and analyze your data—finding all people born in a certain location, or listing everyone missing a death date.

**The Approach**

1. Ensure Bases are created by running **Create All Bases** from Control Center or the command palette
2. Open the `people.base` file in your Bases folder
3. Use Bases' built-in views to filter and sort:
   - Filter by birth place to find geographic clusters
   - Sort by birth date to see chronological order
   - Filter for empty death dates to find incomplete records
4. Create custom views for your specific research needs
5. Save views for quick access

**Tips**

- **Pre-built views:** Canvas Roots base templates include several pre-configured views (by birth year, by location, missing data, etc.).
- **Cross-reference:** Use Bases to identify patterns you might miss browsing individual notes.
- **Data quality:** Filter for missing required fields to create a to-do list for data cleanup.

---

*Have a use case to share? Post in the [Use Cases discussion category](https://github.com/banisterious/obsidian-canvas-roots/discussions/categories/use-cases)!*

---

## Share Your Story

We'd love to feature your workflow! [Post in the Use Cases discussion category](https://github.com/banisterious/obsidian-canvas-roots/discussions/categories/use-cases) and consider including:

- What problem were you trying to solve?
- Which Canvas Roots features did you use?
- What worked well? Any tips for others?
- Screenshots or examples (optional but helpful)

Your workflow might be featured on this wiki page!

---

**Questions?** Open an issue on [GitHub](https://github.com/banisterious/obsidian-canvas-roots/issues).
