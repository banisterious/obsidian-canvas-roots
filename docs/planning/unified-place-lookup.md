# Unified Place Lookup System

- **Status:** Planning
- **Related Issues:** [#128](https://github.com/banisterious/obsidian-canvas-roots/issues/128) (Web Clipper Integration)
- **Created:** 2026-01-08

## Problem Statement

Currently, Canvas Roots requires users to manually create place notes with geographic data. For genealogical research, users need to:
- Standardize place names
- Obtain accurate coordinates
- Understand historical jurisdiction changes
- Link places to parent administrative units
- Track place name variations over time

Multiple excellent place data sources exist (FamilySearch Places, Wikidata, GeoNames, GOV, etc.), but there's no unified way to query them and create Canvas Roots place notes.

## Proposed Solution

Create a **Unified Place Lookup** system that:
1. Provides a single interface for querying multiple place databases
2. Allows users to choose the best source for their research needs
3. Automatically creates properly-formatted Canvas Roots place notes
4. Supports both Web Clipper templates and native plugin integration

## Architecture

### Native Plugin Integration (Primary Approach)

Add place lookup directly to Canvas Roots plugin for seamless integration:

**Features:**
1. **"Lookup Place" button in Create Place modal**
   - User enters partial place name
   - Plugin queries multiple sources
   - Results displayed in modal for selection
   - Selected result populates place form fields

2. **Multi-source search with result comparison**
   - Query FamilySearch, Wikidata, GeoNames, etc. in parallel
   - Display results side-by-side with source indicators
   - Show confidence scores and data completeness
   - User selects best match

3. **Automatic parent place hierarchy creation**
   - Extract parent jurisdictions from API results
   - Check if parent places already exist
   - Offer to create missing parents automatically
   - Link child to parent via `parent_place_id`

4. **Bulk place standardization**
   - Settings → Places → "Standardize Places" command
   - Scan existing place notes missing coordinates
   - Batch lookup and update
   - Preview changes before applying

5. **Command palette integration**
   - "Canvas Roots: Look up place" command
   - Creates new place note from lookup
   - Accessible outside Create Place modal

**Why Native Integration is Better:**
- ✅ Seamless UX within Obsidian
- ✅ No external HTML files needed
- ✅ API key management in plugin settings
- ✅ Direct integration with place creation workflow
- ✅ Can leverage existing Canvas Roots services
- ✅ Better error handling and user feedback

### Web Clipper Templates (Optional Supplement)

For users who prefer clipping places from web pages, provide templates as supplements:
- Extract place data from Wikipedia articles
- Clip from genealogy website place pages
- **Not a primary workflow** - just an alternative for specific use cases

## Implementation Details

### 1. Core Service: PlaceLookupService

Create `src/services/place-lookup-service.ts`:

```typescript
import { requestUrl } from 'obsidian';
import { Logger } from '../logger';

const logger = new Logger('PlaceLookupService');

/**
 * Result from a place lookup query
 */
export interface PlaceLookupResult {
    source: 'familysearch' | 'wikidata' | 'geonames' | 'gov' | 'nominatim';
    standardizedName: string;
    coordinates?: { lat: number; lng: number };
    placeType?: string;
    parentPlace?: string;
    hierarchy?: string[]; // Full administrative chain
    alternateNames?: string[];
    externalId?: string; // Source-specific ID
    confidence: number; // 0-1 score based on match quality
    metadata?: Record<string, any>; // Source-specific additional data
}

/**
 * Options for place lookup
 */
export interface PlaceLookupOptions {
    sources?: Array<'familysearch' | 'wikidata' | 'geonames' | 'gov' | 'nominatim'>;
    historicalDate?: string; // YYYY-MM-DD format for time-aware lookups
    countryCode?: string; // ISO 3166-1 alpha-2 for GeoNames
    maxResults?: number; // Max results per source
}

/**
 * Service for looking up places from multiple external sources
 */
export class PlaceLookupService {
    private geonamesUsername?: string;

    constructor(geonamesUsername?: string) {
        this.geonamesUsername = geonamesUsername;
    }

    /**
     * Look up a place across multiple sources
     */
    async lookup(
        placeName: string,
        options: PlaceLookupOptions = {}
    ): Promise<PlaceLookupResult[]> {
        const sources = options.sources || ['familysearch', 'wikidata', 'geonames'];
        const results: PlaceLookupResult[] = [];

        // Query all sources in parallel
        const promises = sources.map(source => {
            switch (source) {
                case 'familysearch':
                    return this.lookupFamilySearch(placeName, options);
                case 'wikidata':
                    return this.lookupWikidata(placeName, options);
                case 'geonames':
                    return this.lookupGeoNames(placeName, options);
                case 'gov':
                    return this.lookupGOV(placeName, options);
                case 'nominatim':
                    return this.lookupNominatim(placeName, options);
                default:
                    return Promise.resolve([]);
            }
        });

        const sourceResults = await Promise.allSettled(promises);

        for (const result of sourceResults) {
            if (result.status === 'fulfilled') {
                results.push(...result.value);
            } else {
                logger.error('lookup-failed', `Source lookup failed: ${result.reason}`);
            }
        }

        // Sort by confidence score
        return results.sort((a, b) => b.confidence - a.confidence);
    }

    /**
     * Look up place in FamilySearch Places API
     */
    private async lookupFamilySearch(
        placeName: string,
        options: PlaceLookupOptions
    ): Promise<PlaceLookupResult[]> {
        try {
            let url = `https://api.familysearch.org/platform/places/search?name=${encodeURIComponent(placeName)}`;

            if (options.historicalDate) {
                url += `&date=${options.historicalDate}`;
            }

            const response = await requestUrl({
                url,
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });

            const data = response.json;
            const results: PlaceLookupResult[] = [];

            if (data.entries && data.entries.length > 0) {
                const maxResults = options.maxResults || 5;

                for (let i = 0; i < Math.min(data.entries.length, maxResults); i++) {
                    const entry = data.entries[i];
                    const place = entry.content?.gedcomx?.places?.[0];

                    if (!place) continue;

                    // Extract place ID from URI
                    const placeId = place.id?.match(/\d+$/)?.[0];

                    // Build hierarchy from jurisdiction chain
                    const hierarchy: string[] = [];
                    if (place.jurisdiction) {
                        // Parse jurisdiction chain
                        for (const jurisdiction of place.jurisdiction) {
                            if (jurisdiction.names?.[0]?.value) {
                                hierarchy.push(jurisdiction.names[0].value);
                            }
                        }
                    }

                    // Extract alternate names
                    const alternateNames: string[] = [];
                    if (place.names) {
                        for (const nameObj of place.names) {
                            if (nameObj.value && nameObj.value !== place.display?.name) {
                                alternateNames.push(nameObj.value);
                            }
                        }
                    }

                    results.push({
                        source: 'familysearch',
                        standardizedName: place.display?.name || placeName,
                        coordinates: place.latitude && place.longitude
                            ? { lat: place.latitude, lng: place.longitude }
                            : undefined,
                        placeType: place.type?.toLowerCase(),
                        parentPlace: hierarchy[hierarchy.length - 2], // Immediate parent
                        hierarchy,
                        alternateNames,
                        externalId: placeId,
                        confidence: i === 0 ? 0.9 : 0.7 - (i * 0.1), // First result highest confidence
                        metadata: {
                            jurisdictionHistory: place.temporalExtent // Historical jurisdiction data if available
                        }
                    });
                }
            }

            return results;
        } catch (error) {
            logger.error('familysearch-lookup-failed', `FamilySearch lookup failed: ${error}`);
            return [];
        }
    }

    /**
     * Look up place in Wikidata
     */
    private async lookupWikidata(
        placeName: string,
        options: PlaceLookupOptions
    ): Promise<PlaceLookupResult[]> {
        try {
            // Check if input is a Q-number
            const qMatch = placeName.match(/^Q\d+$/i);
            let entityId: string | null = null;

            if (qMatch) {
                entityId = qMatch[0].toUpperCase();
            } else {
                // Search for place by name
                const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(placeName)}&language=en&format=json&origin=*`;
                const searchResponse = await requestUrl({ url: searchUrl });
                const searchData = searchResponse.json;

                if (searchData.search && searchData.search.length > 0) {
                    entityId = searchData.search[0].id;
                }
            }

            if (!entityId) return [];

            // Get entity data
            const entityUrl = `https://www.wikidata.org/wiki/Special:EntityData/${entityId}.json`;
            const entityResponse = await requestUrl({ url: entityUrl });
            const entityData = entityResponse.json;

            const entity = entityData.entities[entityId];
            if (!entity) return [];

            // Extract coordinates (P625)
            const coordClaim = entity.claims?.P625?.[0];
            const coordinates = coordClaim?.mainsnak?.datavalue?.value;

            // Extract administrative territory (P131)
            const adminClaim = entity.claims?.P131?.[0];
            let parentPlace: string | undefined;
            if (adminClaim?.mainsnak?.datavalue?.value?.id) {
                const parentId = adminClaim.mainsnak.datavalue.value.id;
                // Fetch parent name (simplified, could be optimized)
                try {
                    const parentUrl = `https://www.wikidata.org/wiki/Special:EntityData/${parentId}.json`;
                    const parentResponse = await requestUrl({ url: parentUrl });
                    const parentData = parentResponse.json;
                    parentPlace = parentData.entities[parentId]?.labels?.en?.value;
                } catch {
                    // Parent fetch failed, continue without
                }
            }

            // Extract alternate names
            const alternateNames: string[] = [];
            if (entity.aliases?.en) {
                alternateNames.push(...entity.aliases.en.map((a: any) => a.value));
            }
            // Add labels in other languages
            for (const [lang, labelObj] of Object.entries(entity.labels || {})) {
                if (lang !== 'en' && typeof labelObj === 'object' && 'value' in labelObj) {
                    alternateNames.push(`${(labelObj as any).value} (${lang})`);
                }
            }

            // Extract Wikipedia URL
            const wikipediaUrl = entity.sitelinks?.enwiki?.url;

            return [{
                source: 'wikidata',
                standardizedName: entity.labels?.en?.value || placeName,
                coordinates: coordinates
                    ? { lat: coordinates.latitude, lng: coordinates.longitude }
                    : undefined,
                placeType: undefined, // Could extract from P31 (instance of)
                parentPlace,
                hierarchy: parentPlace ? [parentPlace] : [],
                alternateNames,
                externalId: entityId,
                confidence: 0.85,
                metadata: {
                    wikipediaUrl
                }
            }];
        } catch (error) {
            logger.error('wikidata-lookup-failed', `Wikidata lookup failed: ${error}`);
            return [];
        }
    }

    /**
     * Look up place in GeoNames
     */
    private async lookupGeoNames(
        placeName: string,
        options: PlaceLookupOptions
    ): Promise<PlaceLookupResult[]> {
        if (!this.geonamesUsername) {
            logger.warn('geonames-no-username', 'GeoNames username not configured');
            return [];
        }

        try {
            let url = `http://api.geonames.org/searchJSON?q=${encodeURIComponent(placeName)}&username=${this.geonamesUsername}&maxRows=${options.maxResults || 5}`;

            if (options.countryCode) {
                url += `&country=${options.countryCode}`;
            }

            const response = await requestUrl({ url });
            const data = response.json;

            const results: PlaceLookupResult[] = [];

            if (data.geonames && data.geonames.length > 0) {
                for (let i = 0; i < data.geonames.length; i++) {
                    const place = data.geonames[i];

                    // Build hierarchy
                    const hierarchy: string[] = [];
                    if (place.adminName4) hierarchy.push(place.adminName4);
                    if (place.adminName3) hierarchy.push(place.adminName3);
                    if (place.adminName2) hierarchy.push(place.adminName2);
                    if (place.adminName1) hierarchy.push(place.adminName1);
                    if (place.countryName) hierarchy.push(place.countryName);

                    results.push({
                        source: 'geonames',
                        standardizedName: place.name,
                        coordinates: { lat: place.lat, lng: place.lng },
                        placeType: place.fcode?.toLowerCase(),
                        parentPlace: place.adminName1 || place.countryName,
                        hierarchy,
                        alternateNames: place.alternateNames?.map((a: any) => a.name) || [],
                        externalId: place.geonameId?.toString(),
                        confidence: i === 0 ? 0.8 : 0.6 - (i * 0.1),
                        metadata: {
                            population: place.population,
                            elevation: place.elevation
                        }
                    });
                }
            }

            return results;
        } catch (error) {
            logger.error('geonames-lookup-failed', `GeoNames lookup failed: ${error}`);
            return [];
        }
    }

    /**
     * Look up place in GOV (German/European)
     */
    private async lookupGOV(
        placeName: string,
        options: PlaceLookupOptions
    ): Promise<PlaceLookupResult[]> {
        try {
            // GOV API endpoint
            const url = `http://gov.genealogy.net/search/query?query=${encodeURIComponent(placeName)}`;

            const response = await requestUrl({ url });
            const data = response.json;

            // GOV API response parsing would go here
            // This is a simplified implementation
            logger.info('gov-lookup', 'GOV lookup implementation needed');

            return [];
        } catch (error) {
            logger.error('gov-lookup-failed', `GOV lookup failed: ${error}`);
            return [];
        }
    }

    /**
     * Look up place using Nominatim (OSM geocoding)
     */
    private async lookupNominatim(
        placeName: string,
        options: PlaceLookupOptions
    ): Promise<PlaceLookupResult[]> {
        try {
            const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(placeName)}&format=json&addressdetails=1&limit=${options.maxResults || 5}`;

            const response = await requestUrl({
                url,
                headers: {
                    'User-Agent': 'Canvas-Roots-Obsidian-Plugin'
                }
            });

            const data = response.json;
            const results: PlaceLookupResult[] = [];

            for (let i = 0; i < data.length; i++) {
                const place = data[i];

                // Build hierarchy from address
                const hierarchy: string[] = [];
                const addr = place.address || {};
                if (addr.city) hierarchy.push(addr.city);
                if (addr.state) hierarchy.push(addr.state);
                if (addr.country) hierarchy.push(addr.country);

                results.push({
                    source: 'nominatim',
                    standardizedName: place.display_name,
                    coordinates: { lat: parseFloat(place.lat), lng: parseFloat(place.lon) },
                    placeType: place.type,
                    parentPlace: addr.state || addr.country,
                    hierarchy,
                    alternateNames: [],
                    externalId: place.place_id?.toString(),
                    confidence: i === 0 ? 0.75 : 0.55 - (i * 0.1)
                });
            }

            return results;
        } catch (error) {
            logger.error('nominatim-lookup-failed', `Nominatim lookup failed: ${error}`);
            return [];
        }
    }
}
```

### 2. Place Lookup Modal

Create `src/ui/place-lookup-modal.ts`:

```typescript
import { App, Modal, Setting } from 'obsidian';
import { PlaceLookupService, PlaceLookupResult } from '../services/place-lookup-service';
import { CanvasRootsSettings } from '../settings';

/**
 * Modal for looking up places from multiple sources
 */
export class PlaceLookupModal extends Modal {
    private placeName: string = '';
    private results: PlaceLookupResult[] = [];
    private onSelect: (result: PlaceLookupResult) => void;
    private lookupService: PlaceLookupService;

    constructor(
        app: App,
        settings: CanvasRootsSettings,
        onSelect: (result: PlaceLookupResult) => void
    ) {
        super(app);
        this.onSelect = onSelect;
        this.lookupService = new PlaceLookupService(settings.geonamesUsername);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('canvas-roots-place-lookup-modal');

        // Title
        contentEl.createEl('h2', { text: 'Look up place' });

        // Search input
        new Setting(contentEl)
            .setName('Place name')
            .setDesc('Enter the place name to search')
            .addText(text => {
                text.setPlaceholder('Springfield, Illinois, USA')
                    .setValue(this.placeName)
                    .onChange(value => {
                        this.placeName = value;
                    });
                text.inputEl.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        this.performLookup();
                    }
                });
            });

        // Source selection
        const sources: Array<'familysearch' | 'wikidata' | 'geonames'> = ['familysearch', 'wikidata', 'geonames'];
        new Setting(contentEl)
            .setName('Sources')
            .setDesc('Select which sources to query')
            .addButton(btn => btn
                .setButtonText('Search all sources')
                .setCta()
                .onClick(() => this.performLookup())
            );

        // Results container
        const resultsContainer = contentEl.createDiv('place-lookup-results');
        resultsContainer.style.marginTop = '20px';

        if (this.results.length > 0) {
            this.displayResults(resultsContainer);
        }
    }

    private async performLookup() {
        if (!this.placeName) return;

        const { contentEl } = this;
        const resultsContainer = contentEl.querySelector('.place-lookup-results') as HTMLElement;

        if (!resultsContainer) return;

        resultsContainer.empty();
        resultsContainer.createEl('p', { text: 'Searching...' });

        try {
            this.results = await this.lookupService.lookup(this.placeName);
            this.displayResults(resultsContainer);
        } catch (error) {
            resultsContainer.empty();
            resultsContainer.createEl('p', {
                text: `Error: ${error}`,
                cls: 'canvas-roots-error'
            });
        }
    }

    private displayResults(container: HTMLElement) {
        container.empty();

        if (this.results.length === 0) {
            container.createEl('p', { text: 'No results found' });
            return;
        }

        container.createEl('h3', { text: `Found ${this.results.length} results` });

        for (const result of this.results) {
            const resultEl = container.createDiv('place-lookup-result-item');

            // Result header with source badge
            const headerEl = resultEl.createDiv('place-lookup-result-header');
            headerEl.createEl('strong', { text: result.standardizedName });
            headerEl.createEl('span', {
                text: result.source.toUpperCase(),
                cls: `place-lookup-source-badge source-${result.source}`
            });

            // Result details
            const detailsEl = resultEl.createDiv('place-lookup-result-details');

            if (result.coordinates) {
                detailsEl.createEl('div', {
                    text: `Coordinates: ${result.coordinates.lat.toFixed(4)}, ${result.coordinates.lng.toFixed(4)}`
                });
            }

            if (result.placeType) {
                detailsEl.createEl('div', {
                    text: `Type: ${result.placeType}`
                });
            }

            if (result.parentPlace) {
                detailsEl.createEl('div', {
                    text: `Parent: ${result.parentPlace}`
                });
            }

            if (result.hierarchy && result.hierarchy.length > 0) {
                detailsEl.createEl('div', {
                    text: `Hierarchy: ${result.hierarchy.join(' → ')}`
                });
            }

            // Confidence indicator
            const confidenceEl = detailsEl.createEl('div', {
                text: `Confidence: ${(result.confidence * 100).toFixed(0)}%`,
                cls: 'place-lookup-confidence'
            });

            // Select button
            new Setting(resultEl)
                .addButton(btn => btn
                    .setButtonText('Use this place')
                    .onClick(() => {
                        this.onSelect(result);
                        this.close();
                    })
                );
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
```

### 3. Integration with Create Place Modal

Modify `src/ui/create-place-modal.ts` to add "Lookup" button:

```typescript
// Add to existing imports
import { PlaceLookupModal } from './place-lookup-modal';
import { PlaceLookupResult } from '../services/place-lookup-service';

// Add to CreatePlaceModal class, in the form building section:

new Setting(contentEl)
    .setName('Place name')
    .setDesc('The name of this place')
    .addText(text => {
        text.setPlaceholder('Springfield')
            .setValue(this.placeData.name || '')
            .onChange(value => {
                this.placeData.name = value;
            });
    })
    .addButton(btn => btn
        .setButtonText('Lookup')
        .setTooltip('Look up place from external sources')
        .onClick(() => {
            this.openPlaceLookup();
        })
    );

// Add new method to CreatePlaceModal:

private openPlaceLookup() {
    const lookupModal = new PlaceLookupModal(
        this.app,
        this.settings,
        (result: PlaceLookupResult) => {
            // Populate form with lookup result
            this.populateFromLookupResult(result);
        }
    );
    lookupModal.open();
}

private populateFromLookupResult(result: PlaceLookupResult) {
    // Update place data
    this.placeData.name = result.standardizedName;

    if (result.coordinates) {
        this.placeData.lat = result.coordinates.lat;
        this.placeData.lng = result.coordinates.lng;
    }

    if (result.placeType) {
        this.placeData.placeType = result.placeType;
    }

    if (result.parentPlace) {
        this.placeData.parentPlaceName = result.parentPlace;
    }

    if (result.alternateNames && result.alternateNames.length > 0) {
        this.placeData.aliases = result.alternateNames;
    }

    // Store external ID as property
    if (result.externalId) {
        // Add source-specific ID to metadata
        // This would be stored as a property like `familysearch_place_id`
    }

    // Refresh the modal display to show populated values
    this.onOpen();
}
```

### 4. Settings for API Keys

Add to `src/settings.ts`:

```typescript
export interface CanvasRootsSettings {
    // ... existing settings

    // Place Lookup Settings
    geonamesUsername?: string;
    enablePlaceLookup: boolean; // Default: true
}

// In SettingsTab.display():

containerEl.createEl('h2', { text: 'Place Lookup' });

new Setting(containerEl)
    .setName('Enable place lookup')
    .setDesc('Allow looking up places from external sources')
    .addToggle(toggle => toggle
        .setValue(this.plugin.settings.enablePlaceLookup)
        .onChange(async value => {
            this.plugin.settings.enablePlaceLookup = value;
            await this.plugin.saveSettings();
        })
    );

new Setting(containerEl)
    .setName('GeoNames username')
    .setDesc('Your GeoNames username (required for GeoNames lookups). Get one free at geonames.org')
    .addText(text => text
        .setPlaceholder('your_username')
        .setValue(this.plugin.settings.geonamesUsername || '')
        .onChange(async value => {
            this.plugin.settings.geonamesUsername = value;
            await this.plugin.saveSettings();
        })
    );
```

### 5. Command Palette Integration

Add to `src/main.ts`:

```typescript
// Add command for standalone place lookup
this.addCommand({
    id: 'lookup-place',
    name: 'Look up place',
    callback: () => {
        const lookupModal = new PlaceLookupModal(
            this.app,
            this.settings,
            async (result: PlaceLookupResult) => {
                // Create place note from lookup result
                await this.createPlaceFromLookup(result);
            }
        );
        lookupModal.open();
    }
});

// Helper method to create place from lookup
private async createPlaceFromLookup(result: PlaceLookupResult): Promise<void> {
    const placeData: Partial<PlaceData> = {
        name: result.standardizedName,
        lat: result.coordinates?.lat,
        lng: result.coordinates?.lng,
        placeType: result.placeType,
        placeCategory: 'real',
        parentPlaceName: result.parentPlace,
        aliases: result.alternateNames
    };

    // Create place note using existing service
    await createPlaceNote(this.app, placeData, {
        directory: this.settings.placesFolder,
        openAfterCreate: true,
        propertyAliases: this.settings.propertyAliases || {}
    });
}
```

### 6. Canvas Roots Property Mapping

When creating place notes from lookup results, the following properties should be set:

**Core Properties:**
- `cr_id`: Auto-generated UUID
- `cr_type`: "place"
- `name`: Standardized place name from lookup result
- `note_type`: "place"

**Geographic Data:**
- `coordinates_lat`: Decimal latitude
- `coordinates_long`: Decimal longitude
- `place_type`: Type (city, county, state, country, etc.)
- `place_category`: Category (defaults to "real")

**Hierarchy:**
- `parent_place`: Wikilink to parent [[Parent Name]]
- `parent_place_id`: cr_id of parent (if already exists in vault)

**Metadata:**
- `aliases`: Alternate names (array)
- `[source]_id`: External database ID (e.g., `familysearch_place_id`, `wikidata_id`, `geonames_id`)

**Source-Specific Properties:**

FamilySearch:
- `familysearch_place_id`: Place ID from FamilySearch
- Can store `jurisdiction_history` in note content if historical date was used

Wikidata:
- `wikidata_id`: Q-number
- `wikipedia_url`: Link to Wikipedia article (in note content or as property)

GeoNames:
- `geonames_id`: GeoNames ID
- Can store `population` and `elevation` in note content

GOV:
- `gov_id`: GOV identifier

### 7. Automatic Parent Place Creation

When a lookup result includes parent place information, the plugin should:

1. **Check if parent exists**: Search vault for place note with matching name
2. **Offer to create parent**: If not found, show option: "Create parent place: [Parent Name]?"
3. **Recursive lookup**: If user accepts, lookup parent place and repeat
4. **Link child to parent**: Set `parent_place_id` to link the hierarchy

This allows building complete place hierarchies from a single lookup:
```
Springfield, Sangamon County, Illinois, USA
  └─ creates: Springfield (child)
  └─ creates: Sangamon County (parent)
  └─ creates: Illinois (grandparent)
  └─ creates: USA (great-grandparent)
```

## Usage Workflow

### Basic Lookup Workflow

**From Create Place Modal:**
1. Open Create Place modal (canvas or command palette)
2. Click "Lookup" button next to place name field
3. Enter place name in lookup modal
4. Click "Search all sources"
5. Review results from multiple sources side-by-side
6. Click "Use this place" for desired result
7. Form auto-populates with coordinates, type, parent, etc.
8. Add any additional details and create place

**From Command Palette:**
1. Run "Canvas Roots: Look up place" command
2. Enter place name and search
3. Select result
4. Place note created automatically and opened

### Advanced Features

**Parent Hierarchy Creation:**
When a result includes parent places:
1. Plugin checks if parents exist
2. Prompts: "Parent place 'Illinois' not found. Create it?"
3. If accepted, looks up parent automatically
4. Recursively creates hierarchy up to root
5. Links all places via `parent_place_id`

**Bulk Place Standardization:**
1. Go to Settings → Places
2. Click "Standardize Places"
3. Plugin scans for places missing coordinates
4. Shows list with "Lookup" button for each
5. Batch process multiple places
6. Preview changes before applying

### Choosing the Right Source

| Research Scenario | Recommended Source |
|-------------------|-------------------|
| U.S. genealogy, historical jurisdictions | **FamilySearch Places** |
| European ancestors, pre-1900 boundaries | **GOV** (German/Europe) or **FamilySearch** |
| Well-known international places | **Wikidata** |
| Modern geography, coordinates | **GeoNames** |
| Geocoding historical names | **Nominatim** |
| Multilingual research | **Wikidata** |
| Comprehensive worldwide coverage | **GeoNames** |

## Additional Features to Implement

### 1. Place Name Authority Control

Prevent duplicate place creation:
- **Fuzzy name matching**: When creating place, search for similar names
- **Disambiguation modal**: "Places with similar names already exist. Use one of these or create new?"
- **Merge tool**: Combine duplicate places, preserving references

### 2. Smart Caching

Optimize API performance:
- **Session cache**: Cache lookup results for current session
- **Deduplication**: Don't re-query same place name within 5 minutes
- **Rate limiting**: Respect API rate limits (especially GeoNames)

### 3. Historical Date Support

For time-aware lookups:
- **Date picker in lookup modal**: Optional date field
- **FamilySearch temporal queries**: Pass date to get historical jurisdictions
- **Timeline visualization**: Show jurisdiction changes over time in note content

### 4. Source Preferences

User configuration:
- **Default sources**: Choose which sources to query by default
- **Source priority**: Rank sources for confidence scoring
- **Disable sources**: Turn off sources not relevant to research

## Testing Plan

### Unit Tests

1. **PlaceLookupService**
   - Test each source lookup method independently
   - Mock API responses for reliable testing
   - Test error handling and fallbacks
   - Verify confidence scoring

2. **PlaceLookupModal**
   - Test search input and result display
   - Test result selection and form population
   - Test empty results handling

3. **Parent Place Resolution**
   - Test hierarchy parsing
   - Test existing parent detection
   - Test recursive parent creation

### Integration Tests

1. **API Integration**
   - Test live API calls (with rate limiting)
   - Verify response parsing
   - Test authentication (GeoNames)

2. **Place Creation**
   - Test creating place from lookup
   - Verify all properties set correctly
   - Test parent linking

3. **Modal Integration**
   - Test lookup from Create Place modal
   - Test lookup from command palette
   - Verify form population

### Test Cases

| Place Name | Source | Expected Result |
|------------|--------|-----------------|
| Springfield, Illinois, USA | FamilySearch | Multiple Springfield matches, user chooses correct county |
| London | Wikidata | Q84, coordinates, parent: England, UK |
| München | GOV | Historical jurisdictions, church units |
| Tokyo | GeoNames | Complete hierarchy: Asia > Japan > Tokyo |
| Constantinople | Nominatim | Geocodes to modern Istanbul |

## Documentation

### User Documentation (Wiki)

Create new wiki page: **Place Lookup**

1. **Getting Started**
   - Enable place lookup in settings
   - Configure GeoNames username (optional but recommended)
   - Using lookup from Create Place modal
   - Using lookup from command palette

2. **Choosing Sources**
   - When to use FamilySearch (genealogy, U.S., historical)
   - When to use Wikidata (well-known places, multilingual)
   - When to use GeoNames (modern geography, worldwide)
   - When to use GOV (German/European historical)
   - When to use Nominatim (geocoding only)

3. **Working with Results**
   - Understanding confidence scores
   - Comparing results from multiple sources
   - Populating place form from lookup
   - Creating parent place hierarchies

4. **Troubleshooting**
   - No results found (try different source or name variation)
   - API errors (check internet connection, API keys)
   - Duplicate places (use authority control to merge)

### Developer Documentation

1. **Adding New Sources**
   - Implement lookup method in PlaceLookupService
   - Map API response to PlaceLookupResult interface
   - Add source to settings dropdown
   - Document API requirements

2. **API Integration Patterns**
   - Using Obsidian's requestUrl
   - Error handling and fallbacks
   - Rate limiting strategies
   - Caching considerations

## Success Metrics

- **User adoption**: Number of place lookups per month
- **Data quality**: Percentage of place notes with coordinates
- **Coverage**: Percentage of person notes linked to standardized places
- **Efficiency**: Time saved vs. manual place entry

## Future Enhancements

1. **Additional Sources**
   - Historic Counties project (UK)
   - Vision of Britain (UK)
   - Meyers Gazetteer (historical German)
   - Census place databases (country-specific)

2. **Advanced Features**
   - Historical map overlay visualization
   - Jurisdiction change timeline
   - Place name migration tool (bulk updates)
   - Duplicate place detection and merging

3. **Community Features**
   - Shared place database (opt-in)
   - Community-curated place hierarchies
   - Place name correction suggestions

## Open Questions

1. **API key distribution**: How to handle sources requiring authentication?
   - Option A: User provides their own keys
   - Option B: Canvas Roots provides keys (requires backend service)
   - **Recommendation**: Option A for Phase 1

2. **Caching strategy**: Should we cache API responses?
   - Pros: Faster, reduces API calls
   - Cons: Stale data, storage overhead
   - **Recommendation**: Session cache only, no persistent cache

3. **Conflict resolution**: What if multiple sources return different data?
   - Display all results for user to choose
   - Implement confidence scoring
   - **Recommendation**: User chooses, with source recommendations

4. **Historical dates**: How to handle places that changed names/boundaries?
   - FamilySearch Places supports date parameter
   - Create separate place notes for different time periods?
   - **Recommendation**: Document in note content, single place note with timeline

## Implementation Roadmap

### Phase 1: Core Lookup Service (v0.19.0)

1. ✅ Create planning document
2. Implement PlaceLookupService
   - FamilySearch Places lookup method
   - Wikidata lookup method
   - GeoNames lookup method (requires username)
   - Stub methods for GOV and Nominatim
3. Add settings for place lookup
   - Enable/disable toggle
   - GeoNames username field
4. Add basic unit tests for service

### Phase 2: UI Integration (v0.19.0 or v0.20.0)

1. Implement PlaceLookupModal
   - Search input and source selection
   - Result display with confidence scores
   - "Use this place" button
2. Integrate with Create Place modal
   - Add "Lookup" button
   - Wire up result population
3. Add command palette command
   - Standalone place lookup
   - Direct place creation from result

### Phase 3: Advanced Features (v0.20.0+)

1. Automatic parent place creation
   - Parent detection in lookup results
   - Recursive hierarchy building
   - Duplicate prevention
2. Bulk place standardization tool
   - Scan for places without coordinates
   - Batch lookup interface
   - Preview and apply changes
3. Place name authority control
   - Fuzzy matching on place creation
   - Merge duplicate places
4. Historical date support
   - Date picker in lookup modal
   - FamilySearch temporal queries

### Phase 4: Polish and Documentation (v0.20.0+)

1. Complete GOV and Nominatim implementations
2. Add comprehensive error handling
3. Implement session caching
4. Write user documentation wiki page
5. Create demo video
6. Gather user feedback

## Next Steps

1. ✅ Create planning document (this file)
2. ✅ Document place data source research in [docs/research/place-data-sources.md](../research/place-data-sources.md)
3. Get user feedback on native approach vs. Web Clipper
4. Create GitHub issue for tracking
5. Begin Phase 1 implementation
