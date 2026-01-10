# Place Data Sources for Genealogical Research

**Created:** 2026-01-08
**Purpose:** Reference document for place lookup and Web Clipper template development

This document catalogs available sources for place data that can be used for:
1. Native plugin place lookup (see [Unified Place Lookup](../planning/unified-place-lookup.md))
2. Obsidian Web Clipper templates (see [issue #128](https://github.com/banisterious/obsidian-charted-roots/issues/128))

## Source Comparison

| Source | Coverage | Historical Awareness | Authentication | Genealogy Focus | API Quality |
|--------|----------|---------------------|----------------|-----------------|-------------|
| **FamilySearch Places** | 6M+ places worldwide | ⭐⭐⭐⭐⭐ Time-aware | None required | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Wikidata** | Millions of entities | ⭐⭐⭐ Structured data | None required | ⭐⭐⭐ Good | ⭐⭐⭐⭐⭐ |
| **GeoNames** | 11M+ places | ⭐ Modern only | Free username | ⭐⭐⭐ Decent | ⭐⭐⭐⭐ |
| **GOV** | 1M+ (German/Europe) | ⭐⭐⭐⭐⭐ Historical | None required | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Nominatim** | Current OSM data | ⭐ Current only | None required | ⭐⭐ Fair | ⭐⭐⭐⭐ |

## 1. FamilySearch Places API

### Overview
- **URL Pattern:** `https://www.familysearch.org/platform/places/`
- **Coverage:** 6+ million places worldwide
- **Focus:** Genealogical research with historical jurisdiction tracking
- **Authentication:** None required for search
- **Historical Awareness:** ⭐⭐⭐⭐⭐ (supports date parameter for time-aware lookups)

### Key Features
- **Time-aware queries:** Pass date parameter to get jurisdictions as they existed at that time
- **Standardized place names:** Consistent formatting across database
- **Jurisdiction hierarchy:** Full administrative chain (city → county → state → country)
- **Coordinate data:** Latitude/longitude for mapping
- **Alternate names:** Historical and variant spellings

### API Endpoints

**Search:**
```
GET https://api.familysearch.org/platform/places/search?name={place_name}
GET https://api.familysearch.org/platform/places/search?name={place_name}&date={YYYY-MM-DD}
```

**Place Details:**
```
GET https://api.familysearch.org/platform/places/{place_id}
```

### Response Format
```json
{
  "entries": [
    {
      "content": {
        "gedcomx": {
          "places": [
            {
              "id": "https://familysearch.org/platform/places/12345",
              "display": { "name": "Springfield, Sangamon, Illinois, United States" },
              "latitude": 39.7817,
              "longitude": -89.6501,
              "type": "City",
              "names": [
                { "value": "Springfield" },
                { "value": "Springfield, IL" }
              ],
              "jurisdiction": [
                { "names": [{ "value": "Sangamon" }] },
                { "names": [{ "value": "Illinois" }] },
                { "names": [{ "value": "United States" }] }
              ]
            }
          ]
        }
      }
    }
  ]
}
```

### Use Cases
- **Best for:** U.S. genealogy, historical jurisdictions, time-aware place lookups
- **Ideal when:** Researching ancestors in places with changing boundaries
- **Example:** Finding "Springfield, Sangamon County, Illinois" as it existed in 1850

### Web Clipper Viability
⭐⭐⭐⭐ (4/5) - Would require HTML lookup page approach since no browsable place pages

---

## 2. Wikidata

### Overview
- **URL Pattern:** `https://www.wikidata.org/wiki/Q{id}`
- **Coverage:** Millions of entities (not just places)
- **Focus:** Structured knowledge base with rich metadata
- **Authentication:** None required
- **Historical Awareness:** ⭐⭐⭐ (has temporal properties but not primary focus)

### Key Features
- **Structured properties:** P625 (coordinates), P131 (administrative territory), P17 (country)
- **Multilingual labels:** Place names in many languages
- **Wikipedia integration:** Links to Wikipedia articles
- **Rich metadata:** Population, elevation, timezone, etc.
- **Relationship data:** Part of, located in, contains, etc.

### API Endpoints

**Search by name:**
```
GET https://www.wikidata.org/w/api.php?action=wbsearchentities&search={place_name}&language=en&format=json&origin=*
```

**Entity data:**
```
GET https://www.wikidata.org/wiki/Special:EntityData/{Q-id}.json
```

**SPARQL endpoint:** (for complex queries)
```
POST https://query.wikidata.org/sparql
```

### Response Format
```json
{
  "entities": {
    "Q84": {
      "id": "Q84",
      "labels": { "en": { "value": "London" } },
      "descriptions": { "en": { "value": "capital city of the United Kingdom" } },
      "aliases": { "en": [{ "value": "London, England" }] },
      "claims": {
        "P625": [{
          "mainsnak": {
            "datavalue": {
              "value": { "latitude": 51.507222, "longitude": -0.1275 }
            }
          }
        }],
        "P131": [{
          "mainsnak": {
            "datavalue": { "value": { "id": "Q21" } }
          }
        }]
      }
    }
  }
}
```

### Use Cases
- **Best for:** Well-known places, multilingual research, rich metadata
- **Ideal when:** Need Wikipedia article integration or alternate language names
- **Example:** Looking up "London" (Q84) with links to Wikipedia and coordinates

### Web Clipper Viability
⭐⭐⭐⭐⭐ (5/5) - Has browsable pages, structured data, and JSON-LD

---

## 3. GeoNames

### Overview
- **URL Pattern:** `http://www.geonames.org/{geonameid}/`
- **Coverage:** 11+ million places worldwide
- **Focus:** Modern geographic names and administrative divisions
- **Authentication:** Free username required (register at geonames.org)
- **Historical Awareness:** ⭐ (current geography only)

### Key Features
- **Comprehensive coverage:** Cities, counties, states, countries worldwide
- **Administrative hierarchy:** Up to 4 admin levels
- **Feature codes:** Detailed place type classification (PPL, ADM1, ADM2, etc.)
- **Alternate names:** Multiple languages and variants
- **Population data:** Current population estimates
- **Elevation data:** Meters above sea level

### API Endpoints

**Search:**
```
GET http://api.geonames.org/searchJSON?q={place_name}&username={username}&maxRows=10
```

**Search with country filter:**
```
GET http://api.geonames.org/searchJSON?q={place_name}&country={ISO_code}&username={username}
```

**Place details:**
```
GET http://api.geonames.org/getJSON?geonameId={id}&username={username}
```

### Response Format
```json
{
  "geonames": [
    {
      "geonameId": 4250542,
      "name": "Springfield",
      "lat": 39.78172,
      "lng": -89.65012,
      "countryCode": "US",
      "countryName": "United States",
      "adminName1": "Illinois",
      "adminName2": "Sangamon County",
      "fcode": "PPLA2",
      "population": 116250,
      "elevation": 187,
      "alternateNames": [
        { "name": "Springfield, IL" }
      ]
    }
  ]
}
```

### Use Cases
- **Best for:** Modern geography, worldwide coverage, coordinates
- **Ideal when:** Need current administrative divisions or population data
- **Example:** Finding "Springfield" in any country with admin hierarchy

### Web Clipper Viability
⭐⭐⭐ (3/5) - Has web pages but limited genealogical context, API is better

---

## 4. GOV (Geschichtliches Ortsverzeichnis)

### Overview
- **URL Pattern:** `http://gov.genealogy.net/item/show/{gov_id}`
- **Coverage:** 1+ million places (primarily German/European)
- **Focus:** Historical administrative boundaries and church jurisdictions
- **Authentication:** None required
- **Historical Awareness:** ⭐⭐⭐⭐⭐ (designed for historical research)

### Key Features
- **Historical boundaries:** Tracks territorial changes over time
- **Church jurisdictions:** Parish and diocese information
- **Temporal relationships:** "Part of X from YYYY to YYYY"
- **German expertise:** Best source for German genealogy
- **European coverage:** Strong for Central/Eastern Europe

### API Endpoints

**Search:**
```
GET http://gov.genealogy.net/search/query?query={place_name}
```

**Place details:**
```
GET http://gov.genealogy.net/item/show/{gov_id}.json
```

### Response Format
```json
{
  "id": "object_1234567",
  "name": "München",
  "type": "city",
  "coordinates": { "lat": 48.1351, "lon": 11.5820 },
  "relations": [
    {
      "type": "partOf",
      "target": "object_7654321",
      "targetName": "Bayern",
      "from": "1806",
      "to": null
    }
  ]
}
```

### Use Cases
- **Best for:** German genealogy, European historical boundaries, church records
- **Ideal when:** Researching German/Austrian/Polish ancestors
- **Example:** Finding "München" with historical Bavaria jurisdictions

### Web Clipper Viability
⭐⭐⭐⭐ (4/5) - Has browsable pages with structured historical data

---

## 5. OpenStreetMap Nominatim

### Overview
- **URL Pattern:** `https://nominatim.openstreetmap.org/`
- **Coverage:** Current worldwide geography from OpenStreetMap
- **Focus:** Geocoding and reverse geocoding
- **Authentication:** None required (but use User-Agent header)
- **Historical Awareness:** ⭐ (current data only)

### Key Features
- **Free geocoding:** Convert place names to coordinates
- **Reverse geocoding:** Convert coordinates to place names
- **Address parsing:** Extract city, state, country from full addresses
- **OSM integration:** Backed by OpenStreetMap data
- **No API key:** Just requires User-Agent header

### API Endpoints

**Search:**
```
GET https://nominatim.openstreetmap.org/search?q={place_name}&format=json&addressdetails=1
```

**Reverse geocoding:**
```
GET https://nominatim.openstreetmap.org/reverse?lat={lat}&lon={lon}&format=json
```

### Response Format
```json
[
  {
    "place_id": 235253670,
    "display_name": "Springfield, Sangamon County, Illinois, United States",
    "lat": "39.7817213",
    "lon": "-89.6501481",
    "type": "city",
    "address": {
      "city": "Springfield",
      "county": "Sangamon County",
      "state": "Illinois",
      "country": "United States",
      "country_code": "us"
    }
  }
]
```

### Use Cases
- **Best for:** Geocoding historical place names to modern coordinates
- **Ideal when:** Need to map places that no longer exist using current geography
- **Example:** Geocoding "Constantinople" returns Istanbul coordinates

### Web Clipper Viability
⭐⭐ (2/5) - No browsable place pages, API-only service

---

## Recommendations by Research Scenario

### U.S. Genealogy
**Primary:** FamilySearch Places API
**Secondary:** GeoNames (for modern context)
**Why:** FamilySearch has best U.S. historical jurisdiction data with time-aware lookups

### European Genealogy (especially German)
**Primary:** GOV
**Secondary:** FamilySearch Places API
**Why:** GOV specializes in European historical boundaries and church jurisdictions

### International/Modern Geography
**Primary:** GeoNames
**Secondary:** Wikidata
**Why:** Best worldwide coverage with current administrative divisions

### Well-Known Places
**Primary:** Wikidata
**Secondary:** Wikipedia (via Web Clipper)
**Why:** Rich metadata, multilingual support, Wikipedia integration

### Historical Place Name Geocoding
**Primary:** FamilySearch Places API
**Secondary:** Nominatim (for missing places)
**Why:** FamilySearch handles historical names; Nominatim provides fallback coordinates

### Multilingual Research
**Primary:** Wikidata
**Secondary:** GeoNames
**Why:** Both support multiple languages and alternate names

---

## Implementation Priority

### For Native Plugin (Unified Place Lookup)
1. **Phase 1:** FamilySearch Places API, Wikidata, GeoNames
2. **Phase 2:** GOV, Nominatim
3. **Rationale:** Phase 1 covers most genealogical use cases; Phase 2 adds specialized sources

### For Web Clipper Templates
1. **High Priority:** Wikidata (has browsable pages, structured data)
2. **Medium Priority:** GOV (browsable, historical focus)
3. **Low Priority:** FamilySearch, GeoNames, Nominatim (API-only or limited web interface)
4. **Rationale:** Web Clipper works best with sources that have dedicated place pages

---

## API Authentication Requirements

| Source | Authentication | How to Get |
|--------|----------------|------------|
| FamilySearch | None | Ready to use |
| Wikidata | None | Ready to use |
| GeoNames | Free username | Register at geonames.org |
| GOV | None | Ready to use |
| Nominatim | User-Agent header | Use "Canvas-Roots-Obsidian-Plugin" |

---

## Rate Limits and Usage Policies

### FamilySearch Places
- **Limit:** Not explicitly documented
- **Policy:** Be respectful, avoid rapid-fire requests
- **Recommendation:** 1 request per second max

### Wikidata
- **Limit:** Not strictly enforced
- **Policy:** Reasonable use, identify your user agent
- **Recommendation:** 5 requests per second max

### GeoNames
- **Free tier:** 20,000 requests per day, max 1000/hour
- **Commercial:** Paid plans available for higher limits
- **Recommendation:** Cache results, batch queries

### GOV
- **Limit:** Not explicitly documented
- **Policy:** Reasonable use
- **Recommendation:** 1 request per second max

### Nominatim
- **Limit:** 1 request per second
- **Policy:** Must use User-Agent header, no heavy usage
- **Recommendation:** Cache aggressively, consider self-hosting for heavy use

---

## Related Documentation

- [Unified Place Lookup Planning](../planning/unified-place-lookup.md) - Native plugin integration
- [Web Clipper Templates](../clipper-templates/CLIPPER-TEMPLATES.md) - Template documentation
- [Geographic Features Wiki](../wiki-content/Geographic-Features.md) - User documentation
- [Issue #128](https://github.com/banisterious/obsidian-charted-roots/issues/128) - Web Clipper template tracking
- [Issue #155](https://github.com/banisterious/obsidian-charted-roots/issues/155) - FamilySearch template specifically

---

## Changelog

- **2026-01-08:** Initial research and documentation created
