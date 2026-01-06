# Web Clipper Templates for Canvas Roots

This directory contains official Web Clipper templates optimized for genealogical research with Canvas Roots.

## Prerequisites

1. **Install Obsidian Web Clipper** - Install the official [Obsidian Web Clipper](https://obsidian.md/clipper) browser extension
2. **Configure Web Clipper** - Set output folder to match your Canvas Roots staging folder (Settings → Canvas Roots → Staging Folder)
3. **Enable Interpreter (optional)** - Some templates use AI extraction. Configure in Web Clipper settings → Interpreter

## How to Import Templates

1. Download the `.json` template file you want to use
2. Open the Obsidian Web Clipper extension in your browser
3. Click the **Settings** cog icon
4. Go to any template in the list
5. Click **Import** in the top right corner
6. Select the downloaded `.json` file

**Alternative:** You can also drag and drop the `.json` file directly into the Web Clipper template area.

## Available Templates

### Find a Grave - Person
**File:** `findagrave-person.json`
**URL Pattern:** `findagrave.com/memorial/*`
**Auto-triggers:** Yes

Simple, fast template that extracts structured data from Find a Grave memorial pages using CSS selectors only.

**Extracts:**
- Birth date and place
- Death date and place
- Burial location (cemetery with full address)
- Memorial photo
- Full page content (includes biography and family information as text)

**Requirements:**
- No Interpreter needed
- Works immediately after import

**Canvas Roots Properties:**
- `clip_source_type`: "findagrave"
- `clipped_from`: Memorial URL
- `clipped_date`: Date clipped
- `note_type`: "person"
- `birth_date`, `birth_place`
- `death_date`, `death_place`
- `burial_place`

---

### Find a Grave - Person (LLM)
**File:** `findagrave-person-llm.json`
**URL Pattern:** `findagrave.com/memorial/*`
**Auto-triggers:** Yes

Enhanced template that uses AI to extract person's name and parse biography/family information from unstructured content.

**Extracts:**
- Full name (extracted via AI for cleaner filename)
- Birth date and place
- Death date and place
- Burial location (cemetery with full address)
- Biography (if available, via AI)
- Family information (if available, via AI)
- Memorial photo

**Requirements:**
- Interpreter must be enabled for name and biography extraction
- Recommended model: Claude Sonnet 4.5 or equivalent

**Canvas Roots Properties:**
- `clip_source_type`: "findagrave"
- `clipped_from`: Memorial URL
- `clipped_date`: Date clipped
- `note_type`: "person"
- `name`: Person's full name
- `birth_date`, `birth_place`
- `death_date`, `death_place`
- `burial_place`

---

### Obituary - Generic
**File:** `obituary-generic.json`
**URL Pattern:** Works on any obituary website
**Auto-triggers:** No (manual selection)

AI-powered template that extracts biographical information from obituaries across any website. Works with Legacy.com, Tributes.com, newspaper obituaries, and funeral home websites.

**Extracts:**
- Full name (via AI)
- Birth date and place
- Death date and place
- Age at death
- Funeral/memorial service information
- Surviving family members
- Predeceased family members
- Biography and life story

**Requirements:**
- Interpreter must be enabled
- Recommended model: Claude Sonnet 4.5 or equivalent

**Canvas Roots Properties:**
- `clip_source_type`: "obituary"
- `clipped_from`: Obituary URL
- `clipped_date`: Date clipped
- `note_type`: "person"
- `name`: Person's full name
- `birth_date`, `birth_place`
- `death_date`, `death_place`

**Note:** Because obituary websites vary widely, this template does not auto-trigger. Select it manually when clipping obituaries.

## Using Templates with Canvas Roots

Once you've imported a template and clipped content:

1. **Web Clipper auto-detects clipped notes** - Canvas Roots monitors your staging folder for notes with clipper metadata
2. **Dashboard shows clip count** - See "X clips (Y new)" in the Staging card
3. **Review in Staging Manager** - Click "Review" to open Staging Manager
4. **Filter clipped notes** - Use toggle buttons: [All] [Clipped] [Other]
5. **Promote to main tree** - Review and promote clipped notes to your family tree

See the [Web Clipper Integration](../wiki-content/Web-Clipper-Integration.md) wiki page for detailed setup and usage instructions.

## Template Compatibility

- **Schema Version:** 0.1.0
- **Canvas Roots Version:** v0.18.25+
- **Web Clipper Version:** Latest recommended

## Contributing Templates

Have a genealogical Web Clipper template you'd like to share? Please:

1. Test thoroughly on multiple example pages
2. Include Canvas Roots clipper metadata properties:
   - `clip_source_type` (e.g., "ancestry", "familysearch", etc.)
   - `clipped_from` (URL: `{{url}}`)
   - `clipped_date` (Date: `{{date}}`)
3. Submit via GitHub issue or pull request with:
   - Template JSON file
   - Example output
   - Known limitations

## Troubleshooting

**Template not auto-selecting:**
- Verify the URL matches the trigger pattern
- Check template order in Web Clipper settings (first match wins)

**Empty fields:**
- CSS selectors may have changed - inspect page HTML and update selectors
- For AI-extracted fields, ensure Interpreter is enabled and running

**Clips not detected by Canvas Roots:**
- Verify Web Clipper output folder matches Canvas Roots staging folder
- Ensure template includes `clip_source_type` or `clipped_from` property

## Resources

- [Web Clipper Integration Wiki](../wiki-content/Web-Clipper-Integration.md)
- [Obsidian Web Clipper Documentation](https://help.obsidian.md/Clipper)
- [Canvas Roots GitHub Issues](https://github.com/banisterious/obsidian-canvas-roots/issues)
