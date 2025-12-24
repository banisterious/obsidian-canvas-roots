# Essential Properties

A quick-reference guide to the most important frontmatter properties for each entity type. For complete documentation, see the full [Frontmatter Reference](Frontmatter-Reference).

---

## Person Notes

| Property | Description | Required |
|----------|-------------|:--------:|
| `cr_type` | Must be `"person"` | Yes |
| `cr_id` | Unique identifier | Yes |
| `name` | Full name | Yes |
| `father` / `mother` | Wikilinks to parents | No |
| `spouse` | Array of spouse wikilinks | No |
| `born` / `died` | Dates (YYYY-MM-DD) | No |

```yaml
---
cr_type: person
cr_id: john-smith-1850
name: John Smith
born: 1850-03-15
died: 1920-07-22
father: "[[William Smith]]"
mother: "[[Mary Jones]]"
spouse:
  - "[[Sarah Brown]]"
---
```

---

## Place Notes

| Property | Description | Required |
|----------|-------------|:--------:|
| `cr_type` | Must be `"place"` | Yes |
| `cr_id` | Unique identifier | Yes |
| `name` | Place name | Yes |
| `coordinates` | Lat/long for map display | No |
| `parent_place` | Wikilink to parent place | No |

```yaml
---
cr_type: place
cr_id: boston-ma
name: Boston
coordinates: [42.3601, -71.0589]
parent_place: "[[Massachusetts]]"
---
```

---

## Event Notes

| Property | Description | Required |
|----------|-------------|:--------:|
| `cr_type` | Must be `"event"` | Yes |
| `cr_id` | Unique identifier | Yes |
| `title` | Event title | Yes |
| `event_type` | Type (birth, death, marriage, etc.) | Yes |
| `date` | Event date (ISO format) | No |
| `date_precision` | exact, month, year, decade, estimated, range | No |
| `person` | Primary person wikilink | No |
| `place` | Location wikilink | No |
| `confidence` | high, medium, low, or unknown | No |

```yaml
---
cr_type: event
cr_id: john-smith-birth
title: Birth of John Smith
event_type: birth
date: 1850-03-15
person: "[[John Smith]]"
place: "[[Boston]]"
confidence: high
---
```

---

## Source Notes

| Property | Description | Required |
|----------|-------------|:--------:|
| `cr_type` | Must be `"source"` | Yes |
| `cr_id` | Unique identifier | Yes |
| `title` | Source title | Yes |
| `source_type` | Type (census, vital_record, etc.) | Yes |
| `source_repository` | Archive or website holding source | No |
| `source_date` | Document date | No |
| `confidence` | high, medium, low, or unknown | No |

```yaml
---
cr_type: source
cr_id: 1860-census-smith
title: 1860 US Census - Smith Household
source_type: census
source_repository: FamilySearch
source_date: 1860-06-15
confidence: high
---
```

---

## Universe Notes

| Property | Description | Required |
|----------|-------------|:--------:|
| `cr_type` | Must be `"universe"` | Yes |
| `cr_id` | Unique identifier | Yes |
| `name` | Universe name | Yes |
| `description` | Brief description of the world | No |
| `author` | Creator of the fictional world | No |
| `genre` | Fantasy, sci-fi, historical, etc. | No |
| `status` | active, draft, or archived | No |
| `default_calendar` | Default calendar cr_id | No |
| `default_map` | Default map cr_id | No |

```yaml
---
cr_type: universe
cr_id: middle-earth
name: Middle-earth
description: The fantasy world of J.R.R. Tolkien
author: J.R.R. Tolkien
genre: fantasy
status: active
---
```

---

## Custom Map Notes

| Property | Description | Required |
|----------|-------------|:--------:|
| `cr_type` | Must be `"map"` | Yes |
| `map_id` | Unique map identifier | Yes |
| `universe` | Universe for filtering places | Yes |
| `image` | Path to map image | Yes |
| `bounds` | Coordinate bounds (north/south/east/west) | Yes |

```yaml
---
cr_type: map
map_id: middle-earth-map
universe: "[[Middle-earth]]"
image: maps/middle-earth.png
bounds:
  north: 90
  south: -90
  east: 180
  west: -180
---
```

---

## Schema Notes

| Property | Description | Required |
|----------|-------------|:--------:|
| `cr_type` | Must be `"schema"` | Yes |
| `cr_id` | Unique schema identifier | Yes |
| `name` | Display name | Yes |
| `applies_to_type` | Scope: collection, folder, universe, all | Yes |
| `applies_to_value` | Value for scope (if not "all") | No |

Schema definition goes in a `json schema` code block in the note body.

---

## See Also

- [Frontmatter Reference](Frontmatter-Reference) - Complete property documentation
- [Property Aliasing](Release-History#property-aliasing-v0103) - Custom property names
- [Getting Started](Getting-Started) - Setup guide for new users
