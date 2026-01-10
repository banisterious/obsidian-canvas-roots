# Community Use Cases

Real-world examples of how people use Charted Roots for genealogy, worldbuilding, and research.

---

## Table of Contents

**Genealogists**
- [Getting Started from Ancestry or FamilySearch](#getting-started-from-ancestry-or-familysearch)
- [Helping a Non-Technical Family Member Get Started](#helping-a-non-technical-family-member-get-started)
- [Importing from Genealogy Software](#importing-from-genealogy-software)
- [Building a Family Tree from Scratch](#building-a-family-tree-from-scratch)
- [Adding a New Family Member](#adding-a-new-family-member)
- [Deleting a Person and Cleaning Up References](#deleting-a-person-and-cleaning-up-references)
- [Generating a Family Reunion Report](#generating-a-family-reunion-report)
- [Visualizing Migration Patterns](#visualizing-migration-patterns)
- [Tracking DNA Matches](#tracking-dna-matches)
- [Researching Enslaved Ancestors (Beyond Kin)](#researching-enslaved-ancestors-beyond-kin)
- [One-Name Studies](#one-name-studies)
- [FAN Cluster Analysis](#fan-cluster-analysis)
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

### Getting Started from Ancestry or FamilySearch

- **User type:** Genealogist
- **Features used:** GEDCOM Export (from cloud service), GEDCOM Import, Cleanup Wizard, Family Chart
- **Complexity:** Beginner

**The Challenge**

You've been building your family tree on Ancestry.com or FamilySearch, but you're curious about using Obsidian and Charted Roots. You're not very technical, and you want to try Charted Roots without abandoning your existing work or losing data.

**The Approach**

1. **Export your tree from your cloud service:**

   **From Ancestry.com:**
   - Sign in to Ancestry.com
   - Navigate to your family tree
   - Click the **Trees** tab at the top
   - Select your tree from the dropdown
   - Click **Settings** (gear icon)
   - Select **Export tree**
   - Choose GEDCOM format
   - Click **Download** and save the `.ged` file

   **From FamilySearch:**
   - Sign in to FamilySearch.org
   - Navigate to the export tool: https://www.familysearch.org/innovate/export
   - Click **Export** to download your family tree (exports 8 generations of ancestors)
   - Save the `.ged` file

2. **Import into Charted Roots:**
   - In Obsidian, open the **Control Center**
   - Click **Import/Export** in the left sidebar
   - Click **Import GEDCOM**
   - Select the `.ged` file you downloaded
   - Review import options (defaults are usually fine for first-time import)
   - Click **Import**

3. **Clean up your data:**
   - After import completes, run the **Cleanup Wizard** (available in Control Center)
   - This helps identify data quality issues like:
     - Missing birth/death dates
     - Inconsistent place names
     - Incomplete relationships
   - Work through suggested fixes at your own pace

4. **Explore your tree:**
   - Open **Family Chart** view to see visual family trees
   - Browse the **People** list to see all imported individuals
   - Click any person to view/edit their details
   - Try the **Timeline** view to see life events chronologically

**Tips**

- **You can use both:** Exporting to GEDCOM doesn't delete your Ancestry/FamilySearch tree. You can keep using both systems while you explore Charted Roots.
- **Start with one branch:** If your tree is very large, consider exporting just one branch first (e.g., your direct ancestors for 4 generations). You can always import more later.
- **Charted Roots works offline:** Once imported, your data is stored locally in your Obsidian vault. No internet required.
- **Going back is possible:** If you decide Charted Roots isn't for you, you can export to GEDCOM anytime and re-import to other genealogy software.
- **Don't stress about perfection:** The Cleanup Wizard will help you find and fix data issues over time. You don't need to fix everything at once.

---

### Helping a Non-Technical Family Member Get Started

**User type:** Genealogist (supporter helping a family member)
**Features used:** Installation, BRAT, Create Person, Family Chart
**Complexity:** Beginner (with technical support)

**The Challenge**

Your 78-year-old relative expressed interest in using Charted Roots to organize their family tree research. They're not technical—they use email and Facebook, but terms like "plugin" or "YAML" are foreign. You want to help them get started without overwhelming them or committing to being permanent tech support.

**The Reality**

This use case is based on a real experience: the installation process (Obsidian → BRAT → Charted Roots) was successful, but left the relative feeling overwhelmed. While they could technically use the plugin with guidance, the setup complexity created anxiety about using it independently going forward.

**Honest Assessment: Is This a Good Fit?**

Before you begin, ask:

1. **Is your relative already using Obsidian?** If not, they're learning two complex tools at once. This significantly increases overwhelm.
2. **Do they want to *manage research* or just *view a tree*?** If they just want to see relationships visualized, simpler tools (Ancestry, FamilySearch, Gramps) may be better fits.
3. **Are you available for ongoing support?** Charted Roots has a learning curve. Expect follow-up questions about editing notes, troubleshooting, and using features.
4. **Do they enjoy learning new technology?** Some older users thrive on this challenge. Others find it stressful.

**If you decide to proceed:**

**The Setup Approach**

Do the technical heavy lifting for them:

1. **Install Obsidian** on their computer
   - Use their computer, not yours (different operating systems can confuse later instructions)
   - Set up a dedicated vault for their family tree
   - Enable community plugins in Settings → Community plugins

2. **Install BRAT plugin**
   - Browse community plugins → Search for "BRAT" → Install and enable
   - Explain: "This lets you use Charted Roots, which isn't in the official plugin store yet"

3. **Install Charted Roots via BRAT**
   - Settings → BRAT → Add Beta plugin
   - Enter: `banisterious/obsidian-charted-roots`
   - Enable the plugin after installation

4. **Configure basic settings together**
   - Walk through Charted Roots settings
   - Set up folder paths (where notes will be saved)
   - Show them where settings are so they can find them later

5. **Create their first few people together**
   - Open Control Center → People → Create Person
   - Enter their parents or grandparents
   - Show how to link relationships
   - Generate a simple family chart

6. **Create a cheat sheet**
   - Write down common tasks in plain language:
     - "To add a new person: Click the ribbon icon → People → Create Person"
     - "To see your tree: Click the ribbon icon → Open Family Chart"
   - Include screenshots if possible
   - Leave this document open in their vault for reference

**What to Emphasize**

- **You can't break it:** Reassure them that editing notes won't destroy their data. Obsidian keeps backups.
- **Start simple:** They don't need to use every feature. Focus on: adding people, linking relationships, viewing the chart.
- **It's okay to ask for help:** Give them a way to contact you (phone, email) when stuck.

**What Will Be Overwhelming**

Be prepared for these pain points:

- **YAML frontmatter:** The `---` section at the top of notes looks intimidating. Emphasize they can use the GUI (Control Center) to avoid editing it directly.
- **File management:** Obsidian shows files in folders. If they're not comfortable with file systems, this is confusing.
- **Jargon:** Terms like "vault," "canvas," "wikilink," and "ribbon" are Obsidian-specific. Use analogies: "Vault = your filing cabinet, Canvas = your bulletin board."
- **Where to click:** Obsidian has many UI elements (ribbon, command palette, sidebar). Show them the 2-3 places they'll use most often.

**Tips for Supporters**

- **Do the first session in person or via screen share:** Don't try to walk them through installation over the phone.
- **Set realistic expectations:** They won't be proficient immediately. This is okay.
- **Start with import if they have data:** If they've been using Ancestry or FamilySearch, import their GEDCOM first. Starting with a populated tree is less abstract than creating people from scratch.
- **Check in after a week:** Follow up to see how they're doing. Offer a second session to answer questions.
- **Know when to pivot:** If they're still struggling after 2-3 sessions, Charted Roots might not be the right tool. Consider alternatives like Gramps (which has a GUI) or helping them use Ancestry/FamilySearch.

**Signs They'll Be Successful**

- They're excited about the idea of "owning their data"
- They've used other note-taking or organization software before
- They're willing to experiment and learn by trial and error
- They ask clarifying questions rather than shutting down when confused

**Signs This Might Not Work**

- They expect it to "just work" without learning
- They're frustrated or anxious during setup
- They repeatedly ask "Why is this so complicated?" or "Why can't it be simpler?"
- They need step-by-step instructions for every single action

**Alternative: Be Their Charted Roots Manager**

If they have the research knowledge but not the technical skills, consider a different model:

- **They do the research** (gathering records, talking to relatives, taking notes)
- **You manage Charted Roots** (entering data, maintaining the tree, generating charts)
- **You share outputs** (export PDFs, images of the tree, printed reports)

This division of labor can work well for family history projects where the genealogist has the knowledge and the technical family member has the skills.

**Long-Term Sustainability**

For Charted Roots to work long-term for a non-technical user:

1. **They need to become comfortable with basic Obsidian concepts** (notes, folders, links)
2. **They should use primarily the Control Center GUI** rather than editing YAML directly
3. **They need a support person** for when things go wrong (you, or the community)

Without these, they'll likely abandon the tool due to frustration.

**Related**

- [Getting Started from Ancestry or FamilySearch](#getting-started-from-ancestry-or-familysearch) — Importing existing data
- [Building a Family Tree from Scratch](#building-a-family-tree-from-scratch) — Creating people and relationships
- [FAQ: Is Charted Roots right for me?](FAQ#is-canvas-roots-right-for-me-do-i-need-to-be-technical) — Self-assessment for technical comfort

---

### Importing from Genealogy Software

**User type:** Genealogist
**Features used:** GEDCOM Import, Gramps Import, Cleanup Wizard
**Complexity:** Beginner

**The Challenge**

A user new to Charted Roots wants to migrate existing genealogy data from another application (GEDCOM, Gramps, or CSV) and maintain it exclusively in Obsidian going forward.

**The Approach**

1. Open Control Center and click **Import/Export**
2. Select the file to import (GEDCOM, .gramps, or .gpkg)
3. Configure import options (target folders, what to include)
4. Click **Import** and review the results
5. Run the **Cleanup Wizard** to resolve any data quality issues

**Tips**

- **Trial and error is fine:** If the import doesn't look right, delete the Charted Roots folder and try again with different options. Deleting from the file system is faster for large imports.
- **Media files:** When importing a Gramps package (.gpkg), you can avoid duplicating media by deleting the imported `Charted Roots/Media` folder and creating a symbolic link to your original Gramps media folder instead.

---

### Building a Family Tree from Scratch

**User type:** Genealogist
**Features used:** Create Person, Edit Person, Relationship Linking
**Complexity:** Beginner

**The Challenge**

A user new to Charted Roots wants to build their family tree from scratch without importing existing data. They prefer to establish the people and relationships first, then fill in details like events, places, and sources later.

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
- **Bidirectional linking:** When you set Person 2's father as Person 1, Charted Roots automatically adds Person 2 to Person 1's children list.

---

### Adding a New Family Member

**User type:** Genealogist
**Features used:** Create Person, Create Event, Create Place, Link Media, Relationship Linking
**Complexity:** Beginner

**The Challenge**

A new baby has arrived in the family. You want to add the child to your tree along with their birth event, birthplace, birth certificate, and a baby photo. There are multiple ways to accomplish this—which is most efficient?

**Recommended Approach: Create Person First**

This workflow is the most efficient, requiring approximately **34 interactions**.

1. Open **Control Center** → **Dashboard** → **Create New Person Note**
2. Enter name and sex (e.g., "Boy Smith", Male)
3. Link **Father** → Select existing father
4. Link **Mother** → Select existing mother
5. Click **Create Person** → **Done**

*Add the birth event:*

6. Open **Control Center** → **Dashboard** → **Create New Event Note**
7. Enter title (e.g., "Birth of Boy Smith"), select **Birth** as event type
8. **Primary Person** → **Link** → Select the child you just created
9. **Place** → **Link** → Create or select the birth location
10. Click **Create Event**

*Add media:*

11. Right-click the event note → **Charted Roots** → **Media** → **Link Media** → Upload birth certificate
12. Right-click the person note → **Charted Roots** → **Media** → **Link Media** → Upload baby photo

**Alternative: Create Event First**

Starting with the birth event works well when you want to document the event details immediately. This requires approximately **39 interactions**.

1. Open **Control Center** → **Dashboard** → **Create New Event Note**
2. Enter title and select **Birth** as event type
3. **Primary Person** → **Link** → **Create New Person** → Enter name, sex → **Create and Link**
4. **Place** → **Link** → **Create New Place** → Enter name, lookup coordinates → **Create Place**
5. Click **Create Event**

*Link parents (requires navigating to the person note):*

6. In the file explorer, find the new person note
7. Right-click → **Charted Roots** → **Add Relationship** → **Add Father** → Select father
8. Right-click again → **Charted Roots** → **Add Relationship** → **Add Mother** → Select mother

*Add media as above.*

**Alternative: Add via Child Relationship**

Adding a child through the parent's relationship menu is intuitive but less efficient, requiring approximately **45 interactions**. The main drawback: adding a child via one parent doesn't automatically link to the other parent.

1. Find the father's note in the file explorer
2. Right-click → **Charted Roots** → **Add Relationship** → **Add Child** → **Create New Child**
3. Enter name and sex → **Create and Link**
4. Find the mother's note, right-click → **Charted Roots** → **Add Relationship** → **Add Child** → Select the child
5. Continue with adding birthplace, event, and media as above

**Workflow Comparison**

| Approach | Interactions | Best When |
|----------|-------------|-----------|
| **Create Person First** | ~34 | You know the parents and want efficiency |
| **Create Event First** | ~39 | The event details are your starting point |
| **Add via Child Relationship** | ~45 | You're already viewing a parent's note |

**Tips**

- **Person-first is fastest:** Creating the person with both parents linked in one step saves navigation time.
- **Bidirectional linking:** Charted Roots automatically creates the reverse relationship, so you don't need to manually add the child to both parents.
- **Batch media uploads:** If you have multiple documents (birth certificate, hospital record, photos), you can upload them all at once via the media picker.
- **Reuse places:** If the birth location already exists as a place note, linking is faster than creating a new one.

---

### Deleting a Person and Cleaning Up References

**User type:** Genealogist
**Features used:** File Explorer, Cleanup Wizard
**Complexity:** Beginner

**The Challenge**

You received incorrect family information from a relative, or you've discovered duplicate entries in your tree. You need to delete these person notes while ensuring all references to them (in relationship fields, events, sources, etc.) are properly cleaned up.

**The Approach**

Charted Roots doesn't currently have a one-click "Delete Person with cleanup" action, but the two-step workflow is straightforward:

**Step 1: Delete the person note**

1. Find the person note in the file explorer
2. Right-click → **Delete** (or press `Delete` key)
3. Obsidian moves the file to trash

**Step 2: Clean up orphaned references**

1. Open **Control Center** → **Data Quality**
2. Click **Cleanup Wizard**
3. Navigate to **Step 5: Clear orphan references**
4. Click **Scan** to find all references to deleted notes
5. Review the list of orphaned links
6. Click **Fix All** to remove the broken references

**What Gets Cleaned Up**

The Cleanup Wizard detects and removes orphaned references in:
- Relationship fields (`father`, `mother`, `spouse`, `children`)
- Event participant links
- Source person references
- Any other wikilinks pointing to the deleted note

**Tips**

- **Check before deleting:** Use Obsidian's backlinks panel to see what references a person before deleting them.
- **Batch deletions:** If deleting multiple people, delete all the notes first, then run the Cleanup Wizard once to fix all orphaned references at once.
- **Undo available:** Deleted notes go to Obsidian's trash, so you can restore them if needed. The Cleanup Wizard also shows what will be changed before applying fixes.
- **Events and sources:** Deleting a person doesn't automatically delete their associated events or sources. Review these separately if they're no longer needed.

**Related**

- [Data Quality](Data-Quality) — Full documentation for the Cleanup Wizard
- [Staging and Cleanup](Staging-And-Cleanup) — Managing imported data

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

### Researching Enslaved Ancestors (Beyond Kin)

**User type:** Genealogist
**Features used:** Custom Relationships, Person Notes, Source Notes, Wikilinks
**Complexity:** Intermediate

**The Challenge**

You're researching enslaved ancestors using the [Beyond Kin methodology](https://beyondkin.org/), which documents enslaved populations by working outward from slaveholder records. You need to track non-biological connections: enslaved persons to slaveholders, enslaved persons to each other through shared enslavement, and individuals to the source documents where they appear.

**The Approach**

1. Create **Person Notes** for enslaved individuals, using the Beyond Kin naming conventions if desired
2. Create Person Notes for slaveholders and other connected individuals
3. Use the `custom_relationships` property to define non-family connections:
   ```yaml
   custom_relationships:
     - type: enslaved_by
       person: "[[John Slaveholder]]"
       date: "1850"
       source: "[[1850 Slave Schedule]]"
     - type: co_enslaved_with
       person: "[[Mary (enslaved, Smith plantation)]]"
       date: "1850-1860"
   ```
4. Create **Source Notes** for each record (slave schedules, property inventories, estate records)
5. Link source notes to all individuals who appear in them
6. Use the note body to document research notes, hypotheses, and evidence analysis

**Relationship Types for Beyond Kin**

| Type | Description |
|------|-------------|
| `enslaved_by` | Links an enslaved person to their enslaver |
| `co_enslaved_with` | Links individuals enslaved on the same property |
| `documented_in` | Links a person to a source record |
| `possibly_related_to` | Speculative family connection pending evidence |

**Tips**

- **Naming conventions:** Beyond Kin uses specific naming patterns like "Mary (enslaved, Smith plantation, b. abt 1820)". Use these as note titles if it helps your research.
- **Source-centric approach:** In enslaved ancestor research, sources often come first. Create source notes for records, then create person notes as you identify individuals within them.
- **FAN clusters:** This approach also works for documenting Friends, Associates, and Neighbors (FAN) clusters in any genealogical research.
- **Custom properties:** Add properties like `enslaver`, `plantation`, or `enslaved_status` to person notes for filtering and analysis in Bases.

**Further Reading**

- [Beyond Kin Project](https://beyondkin.org/) — Methodology and naming conventions for documenting enslaved populations
- [Custom Relationships](Custom-Relationships) — Full documentation for the `custom_relationships` property

---

### One-Name Studies

**User type:** Genealogist
**Features used:** Collections, Custom Relationships, Person Notes, Source Notes, Canvas Trees
**Complexity:** Intermediate

**The Challenge**

You're conducting a one-name study—researching all individuals with a particular surname regardless of whether they're related to you. You need to track hundreds of people who may or may not be connected, organize them by geographic region or time period, and identify potential family groups within the larger dataset.

**The Approach**

1. Create a **Collection** for your one-name study (e.g., "Henderson One-Name Study")
2. Create **Person Notes** for each individual you discover, adding them to the collection
3. Use the `collection` property to tag all study participants:
   ```yaml
   collection: Henderson One-Name Study
   ```
4. Organize by sub-collections for geographic regions or lineages:
   ```yaml
   collection:
     - Henderson One-Name Study
     - Henderson - Virginia Branch
   ```
5. Use **Custom Relationships** to track speculative connections:
   ```yaml
   custom_relationships:
     - type: possibly_related_to
       person: "[[James Henderson (1820-1890)]]"
       notes: "Same county, similar age, may be brothers"
   ```
6. Generate **Canvas Trees** for confirmed family groups within the study
7. Use the **Statistics View** to analyze your dataset (counts by region, time period, etc.)

**Tips**

- **Naming conventions:** Include distinguishing details in note titles: "John Henderson (1785-1850, Augusta Co, VA)" to differentiate individuals with the same name.
- **Unconnected individuals:** Not everyone needs family links. Person notes can stand alone until you find connections.
- **DNA matches:** Track DNA connections using custom relationships like `dna_match` with notes about shared cM and predicted relationship.
- **Research status:** Add a custom property like `research_status: confirmed | probable | speculative` to track your confidence level.

**Further Reading**

- [Guild of One-Name Studies](https://one-name.org/) — Resources for conducting surname studies
- [Collections](Data-Management#collections) — Organizing people into groups
- [Custom Relationships](Custom-Relationships) — Tracking non-family connections

---

### FAN Cluster Analysis

**User type:** Genealogist
**Features used:** Custom Relationships, Person Notes, Source Notes, Place Notes
**Complexity:** Intermediate

**The Challenge**

You're stuck on a brick wall ancestor and need to research their Friends, Associates, and Neighbors (FAN cluster) to find indirect evidence. You want to track people who appear alongside your ancestor in records—witnesses, neighbors on census pages, fellow church members—and document how they connect.

**The Approach**

1. Create **Person Notes** for your target ancestor and each FAN cluster member
2. Create **Source Notes** for records where cluster members appear together
3. Define custom relationship types for FAN connections:

| Type | Description |
|------|-------------|
| `neighbor` | Lived nearby (census, land records) |
| `witness` | Witnessed a document (deeds, marriages, wills) |
| `bondsman` | Posted bond for marriage or other legal matter |
| `fellow_congregant` | Same church membership |
| `business_associate` | Business dealings, partnerships |
| `migration_companion` | Moved together to a new location |

4. Add FAN relationships to person notes:
   ```yaml
   custom_relationships:
     - type: witness
       person: "[[Samuel Thompson]]"
       date: "1823-05-15"
       source: "[[Deed Book C, p. 142]]"
       notes: "Witnessed land sale from John to William"
     - type: neighbor
       person: "[[Robert Brown]]"
       date: "1820"
       source: "[[1820 Census - Augusta County]]"
       notes: "Listed 3 households apart"
   ```
5. Use **Place Notes** to document locations where the cluster appears
6. Generate a **Canvas Tree** with custom relationships enabled to visualize the cluster

**Tips**

- **Census neighbors:** People listed near each other on census pages often traveled together. Note the page number and enumeration order.
- **Recurring names:** When the same names appear across multiple record types, that's a strong cluster signal.
- **Geographic tracking:** Use Place Notes to map where cluster members appear over time—they may reveal migration patterns.
- **Source-first approach:** Create Source Notes as you find records, then link all individuals who appear in each source.

**Further Reading**

- [Evidence Explained](https://www.evidenceexplained.com/) — Elizabeth Shown Mills' methodology for analyzing evidence
- [Custom Relationships](Custom-Relationships) — Full documentation for tracking non-family connections
- [Evidence and Sources](Evidence-And-Sources) — Source citation and analysis

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

A relative uses different genealogy software (Ancestry, FamilySearch, etc.) and wants a copy of your research. You need to export your Charted Roots data in a format they can import.

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

- **Pre-built views:** Charted Roots base templates include several pre-configured views (by birth year, by location, missing data, etc.).
- **Cross-reference:** Use Bases to identify patterns you might miss browsing individual notes.
- **Data quality:** Filter for missing required fields to create a to-do list for data cleanup.

---

*Have a use case to share? Post in the [Use Cases discussion category](https://github.com/banisterious/obsidian-charted-roots/discussions/categories/use-cases)!*

---

## Share Your Story

We'd love to feature your workflow! [Post in the Use Cases discussion category](https://github.com/banisterious/obsidian-charted-roots/discussions/categories/use-cases) and consider including:

- What problem were you trying to solve?
- Which Charted Roots features did you use?
- What worked well? Any tips for others?
- Screenshots or examples (optional but helpful)

Your workflow might be featured on this wiki page!

---

**Questions?** Open an issue on [GitHub](https://github.com/banisterious/obsidian-charted-roots/issues).
