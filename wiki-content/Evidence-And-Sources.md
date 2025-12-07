# Evidence & Source Management

Canvas Roots provides tools for managing genealogical sources and evidence, helping you document your research with proper citations and track which ancestors are well-documented.

## Overview

The Evidence & Source Management features enable you to:

- Create **source notes** documenting evidence (census records, vital records, photos, etc.)
- Link sources to person notes for proper citation
- Display **source indicators** on generated trees showing research quality
- Manage sources with an **Obsidian Bases template**

## Source Notes

Source notes are structured markdown files that document your evidence. They use flat frontmatter properties following Obsidian best practices.

### Creating a Source Note

**Manual creation:**

Create a new markdown file with this frontmatter structure:

```yaml
---
cr_type: source
cr_id: source-1900-census-smith
title: "1900 US Federal Census - Smith Family"
source_type: census
source_date: "1900-06-01"
source_date_accessed: "2024-03-15"
source_repository: "Ancestry.com"
source_repository_url: "https://www.ancestry.com/..."
collection: "1900 United States Federal Census"
location: "New York, Kings County, Brooklyn"
media: "[[attachments/Census 1900 Smith p1.jpg]]"
confidence: high
---

# 1900 US Federal Census - Smith Family

## Transcription

Line 42: John Smith, Head, Male, White, Age 35, Married...

## Research Notes

This census confirms John's occupation as "carpenter" and lists 4 children.
```

**Using Bases:**

1. Right-click on a folder
2. Select "New sources base from template"
3. Use the table interface to create and edit sources

### Source Note Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | string | Yes | Always `"source"` |
| `cr_id` | string | Yes | Unique identifier |
| `title` | string | Yes | Descriptive title |
| `source_type` | enum | Yes | Type of source (see below) |
| `source_date` | string | No | Date of the original document |
| `source_date_accessed` | string | No | When source was accessed |
| `source_repository` | string | No | Where source is held (archive, website) |
| `source_repository_url` | string | No | URL to online source |
| `collection` | string | No | Collection or record group name |
| `location` | string | No | Geographic location of record |
| `media` | wikilink | No | Primary media file |
| `media_2`, `media_3`, etc. | wikilink | No | Additional media files |
| `confidence` | enum | No | `high`, `medium`, `low`, `unknown` |

### Source Types

| Type | Description |
|------|-------------|
| `census` | Population census records |
| `vital_record` | Birth, death, marriage certificates |
| `church_record` | Baptism, marriage, burial records |
| `photograph` | Photographs and portraits |
| `correspondence` | Letters, emails, postcards |
| `newspaper` | Newspaper articles |
| `obituary` | Death notices, memorial articles |
| `military_record` | Service records, draft cards, pensions |
| `immigration` | Ship manifests, naturalization, passports |
| `court_record` | Legal proceedings, divorces |
| `land_record` | Property records, deeds |
| `will` | Wills |
| `probate` | Estate inventories |
| `oral_history` | Interviews, recordings |

## Linking Sources to People

Source notes link to person notes using wikilinks in the note body. When a source note contains a link like `[[John Smith]]`, Canvas Roots detects this connection automatically.

**Example source note linking to people:**

```markdown
---
cr_type: source
title: "1900 Census - Smith Household"
source_type: census
---

# 1900 Census - Smith Household

## People in this record

- [[John Smith]] - Head of household
- [[Mary Smith]] - Wife
- [[Robert Smith]] - Son

## Transcription
...
```

Canvas Roots uses Obsidian's `resolvedLinks` to detect these connections, so any valid wikilink from a source to a person note will be counted.

## Source Indicators on Trees

When generating family trees, you can display badges showing how many sources link to each person. This provides at-a-glance research quality visibility.

### Enabling Source Indicators

1. Go to **Settings > Canvas Roots > Canvas styling**
2. Enable **"Show source indicators"**
3. Generate or regenerate a family tree

### How Indicators Appear

- Nodes show badges like "📎 3" indicating 3 linked sources
- **Green badges** (3+ sources): Well-documented person
- **Yellow badges** (1-2 sources): Some documentation
- **No badge**: No sources linked yet

### How It Works

During tree generation, Canvas Roots:

1. Scans all notes with `cr_type: source` frontmatter
2. Counts how many link to each person note
3. Adds small text nodes near person nodes showing the count

This helps you identify which ancestors need more research at a glance.

## Sources Bases Template

Canvas Roots includes a pre-configured Obsidian Bases template for managing sources in a spreadsheet-like interface.

### Creating a Sources Base

1. Right-click on a folder containing source notes
2. Select **"New sources base from template"**
3. A `.base` file is created with pre-configured views

### Included Views

| View | Description |
|------|-------------|
| All Sources | Complete inventory |
| By Type | Grouped by source_type |
| By Repository | Grouped by repository |
| By Confidence | Grouped by confidence level |
| Vital Records | Filtered to vital_record type |
| Census Records | Filtered to census type |
| Church Records | Filtered to church/parish records |
| Legal Documents | Wills, probate, land, court records |
| Military Records | Filtered to military_record type |
| Photos & Media | Photographs and newspapers |
| High Confidence | Only high-confidence sources |
| With Media | Sources that have media attached |
| Missing Media | Sources without media |
| By Date | Sorted by document date |
| Recently Accessed | Sorted by access date |
| By Collection | Grouped by collection name |
| By Location | Grouped by location |

## Best Practices

### Organizing Source Notes

- **One source per document**: Create separate notes for each distinct record
- **Reuse for families**: A census image can link to multiple family members
- **Use descriptive titles**: Include year, type, and key names
- **Add transcriptions**: Keep the original text in the note body

### Naming Conventions

Consider consistent naming for source notes:

- `1900 Census - Smith Family - Brooklyn NY`
- `Birth Certificate - John Smith - 1865`
- `Marriage License - Smith-Jones - 1890`

### Media Organization

For source media files (images, PDFs):

- Store in a dedicated attachments folder
- Use descriptive filenames: `1900-census-smith-brooklyn-p1.jpg`
- Link via the `media` property in frontmatter

### Confidence Levels

Use confidence to track source reliability:

| Level | When to Use |
|-------|-------------|
| `high` | Original records, official documents |
| `medium` | Secondary sources, family records |
| `low` | Unverified claims, conflicting information |
| `unknown` | Not yet evaluated |

## Transcription Tips

Canvas Roots doesn't include built-in OCR, but you can transcribe documents using external tools:

| Tool | Best For |
|------|----------|
| [Transkribus](https://transkribus.eu/) | Historical handwriting |
| [FamilySearch Indexing](https://www.familysearch.org/indexing/) | Already indexed records |
| Claude/GPT-4 | General image transcription |
| Manual transcription | Difficult handwriting |

### Workflow

1. Create source note with metadata and media link
2. Open image in external tool or AI chat
3. Paste transcription into source note body
4. Add research notes interpreting the transcription

## Related Pages

- [Tree Generation](Tree-Generation) - Generate trees with source indicators
- [Frontmatter Reference](Frontmatter-Reference) - Complete property documentation
- [Bases Integration](Bases-Integration) - Using Obsidian Bases for data management
- [Roadmap](Roadmap) - Planned source management features
