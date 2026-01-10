/**
 * Template Snippets Modal
 * Provides copyable Templater-compatible templates for Charted Roots note types
 */

import { App, Modal, Notice } from 'obsidian';
import { createLucideIcon } from './lucide-icons';

export type TemplateType = 'person' | 'event' | 'place' | 'source' | 'organization' | 'universe' | 'note' | 'proof' | 'reference';

/**
 * Property aliases mapping type
 * Maps user's custom property name → Charted Roots canonical name
 */
export type PropertyAliases = Record<string, string>;

interface TemplateSnippet {
	name: string;
	description: string;
	template: string;
}

/**
 * Get the property name to use in templates.
 * If an alias exists for the canonical property, returns the user's aliased name.
 * Otherwise returns the canonical name.
 */
function getPropertyName(canonical: string, aliases: PropertyAliases): string {
	for (const [userProp, canonicalProp] of Object.entries(aliases)) {
		if (canonicalProp === canonical) {
			return userProp;
		}
	}
	return canonical;
}

/**
 * Modal displaying copyable template snippets for Templater
 */
export class TemplateSnippetsModal extends Modal {
	private selectedType: TemplateType = 'person';
	private initialTab?: TemplateType;
	private propertyAliases: PropertyAliases;

	constructor(app: App, initialTab?: TemplateType, propertyAliases: PropertyAliases = {}) {
		super(app);
		this.initialTab = initialTab;
		this.propertyAliases = propertyAliases;
		if (initialTab) {
			this.selectedType = initialTab;
		}
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		// Add modal class for styling
		this.modalEl.addClass('crc-template-snippets-modal');

		// Header
		const header = contentEl.createDiv({ cls: 'crc-modal-header' });
		const titleContainer = header.createDiv({ cls: 'crc-modal-title' });
		const icon = createLucideIcon('file-code', 24);
		titleContainer.appendChild(icon);
		titleContainer.appendText('Templater templates');

		// Description
		contentEl.createEl('p', {
			text: 'Copy these templates into your Templater template files. They use Templater syntax for dynamic values.',
			cls: 'crc-text--muted'
		});

		// Tile grid for template type selection
		const tileGrid = contentEl.createDiv({ cls: 'crc-template-tile-grid' });

		type TileConfig = { type: TemplateType; label: string; icon: string; el?: HTMLButtonElement };
		const tiles: TileConfig[] = [
			{ type: 'person', label: 'People', icon: 'users' },
			{ type: 'event', label: 'Events', icon: 'calendar' },
			{ type: 'place', label: 'Places', icon: 'map-pin' },
			{ type: 'source', label: 'Sources', icon: 'archive' },
			{ type: 'organization', label: 'Organizations', icon: 'building' },
			{ type: 'universe', label: 'Universes', icon: 'globe' },
			{ type: 'note', label: 'Notes', icon: 'file-text' },
			{ type: 'proof', label: 'Proof summaries', icon: 'scale' },
			{ type: 'reference', label: 'Reference', icon: 'book-open' }
		];

		for (const tile of tiles) {
			const tileEl = tileGrid.createEl('button', {
				cls: `crc-template-tile${tile.type === this.selectedType ? ' crc-template-tile--active' : ''}`
			});
			tile.el = tileEl;

			const iconContainer = tileEl.createDiv({ cls: 'crc-template-tile-icon' });
			iconContainer.appendChild(createLucideIcon(tile.icon as Parameters<typeof createLucideIcon>[0], 20));

			tileEl.createDiv({ cls: 'crc-template-tile-label', text: tile.label });
		}

		// Template content container
		const templateContainer = contentEl.createDiv({ cls: 'crc-template-container' });

		// Tile click handlers
		for (const tile of tiles) {
			tile.el?.addEventListener('click', () => {
				this.selectedType = tile.type;
				for (const t of tiles) {
					t.el?.removeClass('crc-template-tile--active');
				}
				tile.el?.addClass('crc-template-tile--active');
				this.renderTemplates(templateContainer);
			});
		}

		// Initial render
		this.renderTemplates(templateContainer);

		// Close button
		const buttonContainer = contentEl.createDiv({ cls: 'crc-modal-buttons crc-mt-4' });
		const closeBtn = buttonContainer.createEl('button', {
			text: 'Close',
			cls: 'crc-btn'
		});
		closeBtn.addEventListener('click', () => this.close());
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}

	/**
	 * Render templates for the selected type
	 */
	private renderTemplates(container: HTMLElement): void {
		container.empty();

		// Special case for reference tab - shows variable reference instead of templates
		if (this.selectedType === 'reference') {
			this.renderReferenceContent(container);
			return;
		}

		let templates: TemplateSnippet[];
		switch (this.selectedType) {
			case 'person':
				templates = this.getPersonTemplates();
				break;
			case 'event':
				templates = this.getEventTemplates();
				break;
			case 'place':
				templates = this.getPlaceTemplates();
				break;
			case 'source':
				templates = this.getSourceTemplates();
				break;
			case 'organization':
				templates = this.getOrganizationTemplates();
				break;
			case 'universe':
				templates = this.getUniverseTemplates();
				break;
			case 'note':
				templates = this.getNoteTemplates();
				break;
			case 'proof':
				templates = this.getProofTemplates();
				break;
			default:
				templates = [];
		}

		for (const template of templates) {
			const templateCard = container.createDiv({ cls: 'crc-template-card' });

			// Header
			const cardHeader = templateCard.createDiv({ cls: 'crc-template-card-header' });
			cardHeader.createEl('h4', { text: template.name });
			cardHeader.createEl('p', { text: template.description, cls: 'crc-text--muted' });

			// Code block with copy button
			const codeWrapper = templateCard.createDiv({ cls: 'crc-template-code-wrapper' });

			const codeBlock = codeWrapper.createEl('pre', { cls: 'crc-template-code' });
			codeBlock.createEl('code', { text: template.template });

			const copyBtn = codeWrapper.createEl('button', {
				cls: 'crc-template-copy-btn',
				attr: { 'aria-label': 'Copy template' }
			});
			const copyIcon = createLucideIcon('copy', 16);
			copyBtn.appendChild(copyIcon);

			copyBtn.addEventListener('click', () => {
				void (async () => {
					try {
						await navigator.clipboard.writeText(template.template);
						new Notice('Template copied to clipboard');

						// Visual feedback
						copyBtn.empty();
						const checkIcon = createLucideIcon('check', 16);
						copyBtn.appendChild(checkIcon);
						copyBtn.addClass('crc-template-copy-btn--success');

						setTimeout(() => {
							copyBtn.empty();
							copyBtn.appendChild(createLucideIcon('copy', 16));
							copyBtn.removeClass('crc-template-copy-btn--success');
						}, 2000);
					} catch {
						new Notice('Failed to copy template');
					}
				})();
			});
		}
	}

	/**
	 * Render the Templater variable reference
	 */
	private renderVariableReference(container: HTMLElement): void {
		const variables = [
			{ syntax: '<% tp.file.title %>', description: 'Current file name (for name field)' },
			{ syntax: '<% tp.date.now("YYYY-MM-DD") %>', description: 'Today\'s date (for born/died fields)' },
			{ syntax: '<% tp.file.cursor() %>', description: 'Place cursor here after template insertion' },
			{ syntax: '<% tp.system.prompt("Question?") %>', description: 'Prompt user for input' },
			{ syntax: '<% tp.system.suggester(["opt1", "opt2"], ["val1", "val2"]) %>', description: 'Show selection dialog' }
		];

		const table = container.createEl('table', { cls: 'crc-template-table' });

		const thead = table.createEl('thead');
		const headerRow = thead.createEl('tr');
		headerRow.createEl('th', { text: 'Syntax' });
		headerRow.createEl('th', { text: 'Description' });

		const tbody = table.createEl('tbody');
		for (const v of variables) {
			const row = tbody.createEl('tr');
			const syntaxCell = row.createEl('td');
			syntaxCell.createEl('code', { text: v.syntax, cls: 'crc-template-var' });
			row.createEl('td', { text: v.description });
		}
	}

	/**
	 * Render the reference content (variable reference + documentation links)
	 */
	private renderReferenceContent(container: HTMLElement): void {
		// Variable reference section
		const referenceSection = container.createDiv({ cls: 'crc-template-reference-section' });
		referenceSection.createEl('h4', { text: 'Templater variable reference', cls: 'crc-mb-2' });

		const referenceContent = referenceSection.createDiv({ cls: 'crc-template-reference-content' });
		this.renderVariableReference(referenceContent);

		// Schema documentation link
		const schemaSection = container.createDiv({ cls: 'crc-template-schema-link crc-mt-3' });
		const schemaNote = schemaSection.createEl('p', { cls: 'crc-text--muted' });
		schemaNote.appendText('These templates include common fields. For the complete list of supported frontmatter properties, see the ');
		const schemaLink = schemaNote.createEl('a', {
			text: 'Frontmatter schema reference',
			cls: 'crc-link',
			href: 'https://github.com/banisterious/obsidian-charted-roots/blob/main/docs/reference/frontmatter-schema.md'
		});
		schemaLink.setAttribute('target', '_blank');
		schemaNote.appendText('.');

		// Advanced setup link (user scripts)
		const advancedNote = schemaSection.createEl('p', { cls: 'crc-text--muted crc-mt-2' });
		advancedNote.appendText('For advanced setup with reusable user scripts and cr_id generation functions, see the ');
		const advancedLink = advancedNote.createEl('a', {
			text: 'Templater integration guide',
			cls: 'crc-link',
			href: 'https://github.com/banisterious/obsidian-charted-roots/wiki/Templater-Integration'
		});
		advancedLink.setAttribute('target', '_blank');
		advancedNote.appendText('.');
	}

	/**
	 * Get person note templates
	 */
	private getPersonTemplates(): TemplateSnippet[] {
		const p = (canonical: string) => getPropertyName(canonical, this.propertyAliases);

		return [
			{
				name: 'Basic person note',
				description: 'Minimal template with essential fields',
				template: `---
${p('cr_type')}: person
${p('cr_id')}:
${p('name')}: "<% tp.file.title %>"
${p('sex')}: <% tp.system.suggester(["Male", "Female", "Unknown"], ["M", "F", "U"]) %>
${p('born')}:
${p('died')}:
---

# <% tp.file.title %>

<% tp.file.cursor() %>`
			},
			{
				name: 'Full person note',
				description: 'Complete template with family relationships, dynamic blocks, and place fields',
				template: `---
${p('cr_type')}: person
${p('cr_id')}:
${p('name')}: "<% tp.file.title %>"
${p('sex')}: <% tp.system.suggester(["Male", "Female", "Unknown"], ["M", "F", "U"]) %>

# Dates
${p('born')}:
${p('died')}:

# Family relationships
${p('father')}:
${p('father_id')}:
${p('mother')}:
${p('mother_id')}:
spouse1:
spouse1_id:
spouse1_marriage_date:
spouse1_marriage_location:

# Places
${p('birth_place')}:
${p('death_place')}:
burial_place:

# Sources
${p('sources')}:

# Organization
collection:
---

# <% tp.file.title %>

## Biography

<% tp.file.cursor() %>

## Family

\`\`\`canvas-roots-relationships
type: immediate
\`\`\`

## Timeline

\`\`\`canvas-roots-timeline
sort: chronological
\`\`\`

## Media

\`\`\`canvas-roots-media
columns: 3
editable: true
\`\`\`

## Notes

`
			},
			{
				name: 'Person with prompts',
				description: 'Interactive template that prompts for key information',
				template: `---
${p('cr_type')}: person
${p('cr_id')}:
${p('name')}: "<% tp.file.title %>"
${p('sex')}: <% tp.system.suggester(["Male", "Female", "Unknown"], ["M", "F", "U"]) %>
${p('born')}: <% tp.system.prompt("Birth date (YYYY-MM-DD)?", "", false) %>
${p('died')}: <% tp.system.prompt("Death date (YYYY-MM-DD)? Leave blank if living", "", false) %>
${p('birth_place')}: "<% tp.system.prompt("Birth place?", "", false) %>"
---

# <% tp.file.title %>

<% tp.file.cursor() %>`
			},
			{
				name: 'DNA match',
				description: 'Template for tracking DNA matches from genetic genealogy',
				template: `---
${p('cr_type')}: person
${p('cr_id')}:
${p('name')}: "<% tp.file.title %>"

# DNA match information
dna_shared_cm: <% tp.system.prompt("Shared centiMorgans?", "", false) %>
dna_testing_company: <% tp.system.suggester(["AncestryDNA", "23andMe", "FamilyTreeDNA", "MyHeritage", "LivingDNA", "GEDmatch"], ["AncestryDNA", "23andMe", "FamilyTreeDNA", "MyHeritage", "LivingDNA", "GEDmatch"]) %>
dna_kit_id:
dna_match_type: <% tp.system.suggester(["BKM (Best Known Match)", "BMM (Best Mystery Match)", "Confirmed", "Unconfirmed"], ["BKM", "BMM", "confirmed", "unconfirmed"]) %>
dna_endogamy_flag: false
dna_notes:
---

# <% tp.file.title %>

## Match details

- **Shared DNA:** cM
- **Testing company:**
- **Match type:**

## Relationship hypothesis

<% tp.file.cursor() %>

## Research notes

`
			}
		];
	}

	/**
	 * Get place note templates
	 */
	private getPlaceTemplates(): TemplateSnippet[] {
		const p = (canonical: string) => getPropertyName(canonical, this.propertyAliases);

		return [
			{
				name: 'Basic place note',
				description: 'Minimal template for real-world locations',
				template: `---
${p('cr_type')}: place
${p('cr_id')}:
${p('name')}: "<% tp.file.title %>"
${p('place_type')}: <% tp.system.suggester(["City", "Town", "Village", "Country", "State/Province", "Region", "County"], ["city", "town", "village", "country", "state", "region", "county"]) %>
${p('parent_place')}:
---

# <% tp.file.title %>

<% tp.file.cursor() %>`
			},
			{
				name: 'Place with coordinates',
				description: 'For real-world locations with geographic coordinates',
				template: `---
${p('cr_type')}: place
${p('cr_id')}:
${p('name')}: "<% tp.file.title %>"
place_category: real
${p('place_type')}: <% tp.system.suggester(["City", "Town", "Village", "Country", "State/Province", "Region", "County"], ["city", "town", "village", "country", "state", "region", "county"]) %>
${p('parent_place')}:
${p('coordinates')}:
  lat: <% tp.system.prompt("Latitude?", "", false) %>
  long: <% tp.system.prompt("Longitude?", "", false) %>
---

# <% tp.file.title %>

<% tp.file.cursor() %>`
			},
			{
				name: 'Historical place',
				description: 'For places that no longer exist or have changed significantly',
				template: `---
${p('cr_type')}: place
${p('cr_id')}:
${p('name')}: "<% tp.file.title %>"
place_category: historical
${p('place_type')}: <% tp.system.suggester(["City", "Town", "Village", "Country", "State/Province", "Region", "Kingdom", "Empire"], ["city", "town", "village", "country", "state", "region", "kingdom", "empire"]) %>
${p('parent_place')}:
historical_names:
  - name:
    period:
---

# <% tp.file.title %>

## History

<% tp.file.cursor() %>`
			},
			{
				name: 'Fictional place',
				description: 'For world-building and fictional locations',
				template: `---
${p('cr_type')}: place
${p('cr_id')}:
${p('name')}: "<% tp.file.title %>"
place_category: fictional
${p('universe')}: "<% tp.system.prompt("Universe/World name?", "", false) %>"
${p('place_type')}: <% tp.system.suggester(["City", "Town", "Village", "Country", "Kingdom", "Region", "Castle", "Fortress", "Island"], ["city", "town", "village", "country", "kingdom", "region", "castle", "fortress", "island"]) %>
${p('parent_place')}:
custom_coordinates:
  x:
  y:
  map:
---

# <% tp.file.title %>

## Description

<% tp.file.cursor() %>

## Notable inhabitants

`
			},
			{
				name: 'Full place note',
				description: 'Complete template with all available fields',
				template: `---
${p('cr_type')}: place
${p('cr_id')}:
${p('name')}: "<% tp.file.title %>"
aliases:
  -
place_category: <% tp.system.suggester(["Real", "Historical", "Disputed", "Legendary", "Mythological", "Fictional"], ["real", "historical", "disputed", "legendary", "mythological", "fictional"]) %>
${p('universe')}:
${p('place_type')}: <% tp.system.suggester(["City", "Town", "Village", "Country", "State/Province", "Region", "County", "Kingdom", "Castle"], ["city", "town", "village", "country", "state", "region", "county", "kingdom", "castle"]) %>
${p('parent_place')}:
${p('coordinates')}:
  lat:
  long:
custom_coordinates:
  x:
  y:
  map:
historical_names:
  - name:
    period:
${p('collection')}:
---

# <% tp.file.title %>

<% tp.file.cursor() %>`
			}
		];
	}

	/**
	 * Get source note templates
	 */
	private getSourceTemplates(): TemplateSnippet[] {
		const p = (canonical: string) => getPropertyName(canonical, this.propertyAliases);

		return [
			{
				name: 'Basic source note',
				description: 'Minimal template for documenting a source',
				template: `---
${p('cr_type')}: source
${p('cr_id')}:
${p('title')}: "<% tp.file.title %>"
source_type: <% tp.system.suggester(["Census", "Vital record", "Church record", "Newspaper", "Photo", "Correspondence", "Military", "Court record", "Land deed", "Probate", "Immigration", "Obituary", "Oral history"], ["census", "vital_record", "church_record", "newspaper", "photo", "correspondence", "military", "court_record", "land_deed", "probate", "immigration", "obituary", "oral_history"]) %>
source_date:
${p('confidence')}: <% tp.system.suggester(["High", "Medium", "Low", "Unknown"], ["high", "medium", "low", "unknown"]) %>
---

# <% tp.file.title %>

<% tp.file.cursor() %>`
			},
			{
				name: 'Census source',
				description: 'Template for census records',
				template: `---
${p('cr_type')}: source
${p('cr_id')}:
${p('title')}: "<% tp.file.title %>"
source_type: census
source_date: <% tp.system.prompt("Census date (YYYY-MM-DD)?", "", false) %>
source_date_accessed: <% tp.date.now("YYYY-MM-DD") %>
source_repository: <% tp.system.suggester(["Ancestry.com", "FamilySearch", "FindMyPast", "MyHeritage", "National Archives", "Other"], ["Ancestry.com", "FamilySearch", "FindMyPast", "MyHeritage", "National Archives", ""]) %>
${p('collection')}:
location:
${p('confidence')}: high
source_quality: derivative
media:
---

# <% tp.file.title %>

## Census information

| Field | Value |
|-------|-------|
| Census year |  |
| State/country |  |
| County |  |
| Township/city |  |
| Enumeration district |  |
| Sheet/page |  |

## Household members

| Name | Relation | Age | Birthplace | Occupation |
|------|----------|-----|------------|------------|
|  |  |  |  |  |

## Transcription

<% tp.file.cursor() %>

## Research notes

`
			},
			{
				name: 'Vital record source',
				description: 'Template for birth, death, or marriage certificates',
				template: `---
${p('cr_type')}: source
${p('cr_id')}:
${p('title')}: "<% tp.file.title %>"
source_type: vital_record
source_date: <% tp.system.prompt("Event date (YYYY-MM-DD)?", "", false) %>
source_repository:
location:
${p('confidence')}: high
source_quality: primary
media:
---

# <% tp.file.title %>

## Document information

| Field | Value |
|-------|-------|
| Event type | <% tp.system.suggester(["Birth", "Death", "Marriage"], ["Birth", "Death", "Marriage"]) %> |
| Event date |  |
| Event place |  |
| Certificate number |  |

## People named

-

## Transcription

<% tp.file.cursor() %>`
			},
			{
				name: 'Full source note',
				description: 'Complete template with all source fields',
				template: `---
${p('cr_type')}: source
${p('cr_id')}:
${p('title')}: "<% tp.file.title %>"
source_type: <% tp.system.suggester(["Census", "Vital record", "Church record", "Newspaper", "Photo", "Correspondence", "Military", "Court record", "Land deed", "Probate", "Immigration", "Obituary", "Oral history", "Custom"], ["census", "vital_record", "church_record", "newspaper", "photo", "correspondence", "military", "court_record", "land_deed", "probate", "immigration", "obituary", "oral_history", "custom"]) %>
source_date:
source_date_accessed: <% tp.date.now("YYYY-MM-DD") %>
source_repository:
source_repository_url:
${p('collection')}:
location:
${p('confidence')}: <% tp.system.suggester(["High", "Medium", "Low", "Unknown"], ["high", "medium", "low", "unknown"]) %>
source_quality: <% tp.system.suggester(["Primary (original record)", "Secondary (later account)", "Derivative (copy/transcription)"], ["primary", "secondary", "derivative"]) %>
media:
  -
citation_override:
---

# <% tp.file.title %>

## Source information

<% tp.file.cursor() %>

## Transcription

## Research notes

`
			}
		];
	}

	/**
	 * Get organization note templates
	 */
	private getOrganizationTemplates(): TemplateSnippet[] {
		const p = (canonical: string) => getPropertyName(canonical, this.propertyAliases);

		return [
			{
				name: 'Basic organization note',
				description: 'Minimal template for any organization type',
				template: `---
${p('cr_type')}: organization
${p('cr_id')}:
${p('name')}: "<% tp.file.title %>"
org_type: <% tp.system.suggester(["Noble house", "Guild", "Corporation", "Military", "Religious", "Political", "Educational", "Custom"], ["noble_house", "guild", "corporation", "military", "religious", "political", "educational", "custom"]) %>
---

# <% tp.file.title %>

<% tp.file.cursor() %>`
			},
			{
				name: 'Noble house',
				description: 'Template for feudal houses and dynasties',
				template: `---
${p('cr_type')}: organization
${p('cr_id')}:
${p('name')}: "<% tp.file.title %>"
org_type: noble_house
parent_org:
founded:
dissolved:
motto:
seat:
${p('universe')}: "<% tp.system.prompt("Universe/World name?", "", false) %>"
---

# <% tp.file.title %>

## History

<% tp.file.cursor() %>

## Notable members

## Heraldry

`
			},
			{
				name: 'Military unit',
				description: 'Template for armies, regiments, and military organizations',
				template: `---
${p('cr_type')}: organization
${p('cr_id')}:
${p('name')}: "<% tp.file.title %>"
org_type: military
parent_org:
founded:
dissolved:
seat:
${p('universe')}:
---

# <% tp.file.title %>

## Overview

<% tp.file.cursor() %>

## History

## Campaigns

## Notable members

`
			},
			{
				name: 'Full organization note',
				description: 'Complete template with all organization fields',
				template: `---
${p('cr_type')}: organization
${p('cr_id')}:
${p('name')}: "<% tp.file.title %>"
org_type: <% tp.system.suggester(["Noble house", "Guild", "Corporation", "Military", "Religious", "Political", "Educational", "Custom"], ["noble_house", "guild", "corporation", "military", "religious", "political", "educational", "custom"]) %>
parent_org:
founded: <% tp.system.prompt("Founded date?", "", false) %>
dissolved:
motto:
seat:
${p('universe')}:
${p('collection')}:
---

# <% tp.file.title %>

## Overview

<% tp.file.cursor() %>

## History

## Notable members

## See also

`
			}
		];
	}

	/**
	 * Get universe note templates
	 */
	private getUniverseTemplates(): TemplateSnippet[] {
		const p = (canonical: string) => getPropertyName(canonical, this.propertyAliases);

		return [
			{
				name: 'Basic universe note',
				description: 'Minimal template for fictional worlds and settings',
				template: `---
${p('cr_type')}: universe
${p('cr_id')}:
${p('name')}: "<% tp.file.title %>"
description:
status: active
---

# <% tp.file.title %>

<% tp.file.cursor() %>`
			},
			{
				name: 'Full universe note',
				description: 'Complete template with all universe fields',
				template: `---
${p('cr_type')}: universe
${p('cr_id')}:
${p('name')}: "<% tp.file.title %>"
description: "<% tp.system.prompt("Brief description of this universe?", "", false) %>"
author: "<% tp.system.prompt("Creator/author of this world?", "", false) %>"
genre: <% tp.system.suggester(["Fantasy", "Science Fiction", "Historical Fiction", "Alternate History", "Horror", "Mystery", "Other"], ["fantasy", "scifi", "historical", "alt_history", "horror", "mystery", "other"]) %>
status: <% tp.system.suggester(["Active", "Draft", "Archived"], ["active", "draft", "archived"]) %>
default_calendar:
default_map:
---

# <% tp.file.title %>

## Overview

<% tp.file.cursor() %>

## History

## Major locations

## Notable figures

## Custom date systems

## Maps

`
			},
			{
				name: 'Universe with calendar',
				description: 'Template including custom date system setup',
				template: `---
${p('cr_type')}: universe
${p('cr_id')}:
${p('name')}: "<% tp.file.title %>"
description:
author:
genre: fantasy
status: active
default_calendar: "<% tp.file.title %>-calendar"
---

# <% tp.file.title %>

## Overview

<% tp.file.cursor() %>

## Custom calendar

This universe uses a custom date system. Define your calendar in the Date Systems settings.

### Eras
-

### Months
-

### Notable dates
-

## Major locations

## Notable figures

`
			}
		];
	}

	/**
	 * Get note entity templates (Phase 4 Gramps Notes)
	 */
	private getNoteTemplates(): TemplateSnippet[] {
		const p = (canonical: string) => getPropertyName(canonical, this.propertyAliases);

		return [
			{
				name: 'Basic note',
				description: 'Minimal template for research notes',
				template: `---
${p('cr_type')}: note
${p('cr_id')}:
cr_note_type: <% tp.system.suggester(["Research", "Person Note", "Transcript", "Source text", "General"], ["Research", "Person Note", "Transcript", "Source text", "General"]) %>
private: false
---

# <% tp.file.title %>

<% tp.file.cursor() %>`
			},
			{
				name: 'Research note',
				description: 'Template for documenting research findings',
				template: `---
${p('cr_type')}: note
${p('cr_id')}:
cr_note_type: Research
private: false
linked_entities:
  - "[[<% tp.system.prompt("Related person/event/source?", "", false) %>]]"
---

# <% tp.file.title %>

## Summary

<% tp.file.cursor() %>

## Sources consulted

## Next steps

`
			},
			{
				name: 'Transcript note',
				description: 'For document transcriptions',
				template: `---
${p('cr_type')}: note
${p('cr_id')}:
cr_note_type: Transcript
private: false
source: "[[<% tp.system.prompt("Source document?", "", false) %>]]"
---

# Transcript: <% tp.file.title %>

## Original text

<% tp.file.cursor() %>

## Transcription notes

`
			}
		];
	}

	/**
	 * Get proof summary note templates
	 */
	private getProofTemplates(): TemplateSnippet[] {
		const p = (canonical: string) => getPropertyName(canonical, this.propertyAliases);

		return [
			{
				name: 'Basic proof summary',
				description: 'Minimal template for documenting a genealogical conclusion',
				template: `---
${p('cr_type')}: proof_summary
${p('cr_id')}:
${p('title')}: "<% tp.file.title %>"
subject_person:
fact_type: <% tp.system.suggester(["Birth date", "Birth place", "Death date", "Death place", "Parents", "Marriage date", "Marriage place", "Spouse", "Occupation", "Residence"], ["birth_date", "birth_place", "death_date", "death_place", "parents", "marriage_date", "marriage_place", "spouse", "occupation", "residence"]) %>
conclusion:
status: draft
${p('confidence')}: possible
evidence: []
---

# <% tp.file.title %>

## Conclusion

<% tp.file.cursor() %>

## Evidence analysis

## Reasoning

`
			},
			{
				name: 'Proof summary with evidence',
				description: 'Template with pre-structured evidence entries',
				template: `---
${p('cr_type')}: proof_summary
${p('cr_id')}:
${p('title')}: "<% tp.file.title %>"
subject_person: "[[<% tp.system.prompt("Subject person note name?", "", false) %>]]"
fact_type: <% tp.system.suggester(["Birth date", "Birth place", "Death date", "Death place", "Parents", "Marriage date", "Marriage place", "Spouse", "Occupation", "Residence"], ["birth_date", "birth_place", "death_date", "death_place", "parents", "marriage_date", "marriage_place", "spouse", "occupation", "residence"]) %>
conclusion: "<% tp.system.prompt("What is your conclusion?", "", false) %>"
status: <% tp.system.suggester(["Draft", "Complete", "Needs review", "Conflicted"], ["draft", "complete", "needs_review", "conflicted"]) %>
${p('confidence')}: <% tp.system.suggester(["Proven", "Probable", "Possible", "Disproven"], ["proven", "probable", "possible", "disproven"]) %>
date_written: <% tp.date.now("YYYY-MM-DD") %>
evidence:
  - source:
    information:
    supports: <% tp.system.suggester(["Strongly supports", "Moderately supports", "Weakly supports", "Conflicts with"], ["strongly", "moderately", "weakly", "conflicts"]) %>
    notes:
---

# <% tp.file.title %>

## Conclusion

<% tp.file.cursor() %>

## Evidence analysis

### Source 1

**Information:**

**Assessment:**

### Source 2

**Information:**

**Assessment:**

## Reasoning

## Resolution (if conflicted)

`
			},
			{
				name: 'Conflict resolution proof',
				description: 'Template for documenting how conflicting evidence was resolved',
				template: `---
${p('cr_type')}: proof_summary
${p('cr_id')}:
${p('title')}: "<% tp.file.title %>"
subject_person:
fact_type: <% tp.system.suggester(["Birth date", "Birth place", "Death date", "Death place", "Parents", "Marriage date", "Marriage place", "Spouse"], ["birth_date", "birth_place", "death_date", "death_place", "parents", "marriage_date", "marriage_place", "spouse"]) %>
conclusion:
status: conflicted
${p('confidence')}: possible
date_written: <% tp.date.now("YYYY-MM-DD") %>
evidence:
  - source:
    information:
    supports: strongly
    notes:
  - source:
    information:
    supports: conflicts
    notes:
---

# <% tp.file.title %>

## The conflict

Describe the conflicting evidence here.

<% tp.file.cursor() %>

## Evidence analysis

### Supporting evidence

### Conflicting evidence

## Resolution

Explain how you resolved the conflict and why you chose one conclusion over another.

## Confidence assessment

`
			}
		];
	}

	/**
	 * Get event note templates
	 */
	private getEventTemplates(): TemplateSnippet[] {
		const p = (canonical: string) => getPropertyName(canonical, this.propertyAliases);

		return [
			{
				name: 'Basic event note',
				description: 'Minimal template for recording life events',
				template: `---
${p('cr_type')}: event
${p('cr_id')}:
${p('title')}: "<% tp.file.title %>"
${p('event_type')}: <% tp.system.suggester(["Birth", "Death", "Marriage", "Divorce", "Residence", "Occupation", "Military", "Immigration", "Education", "Burial", "Baptism", "Custom"], ["birth", "death", "marriage", "divorce", "residence", "occupation", "military", "immigration", "education", "burial", "baptism", "custom"]) %>
${p('date')}:
${p('date_precision')}: <% tp.system.suggester(["Exact date", "Month only", "Year only", "Decade", "Estimated", "Date range", "Unknown"], ["exact", "month", "year", "decade", "estimated", "range", "unknown"]) %>
${p('persons')}:
  -
${p('place')}:
${p('sources')}:
${p('confidence')}: <% tp.system.suggester(["High", "Medium", "Low", "Unknown"], ["high", "medium", "low", "unknown"]) %>
---

# <% tp.file.title %>

<% tp.file.cursor() %>`
			},
			{
				name: 'Birth event',
				description: 'Template for recording a birth event',
				template: `---
${p('cr_type')}: event
${p('cr_id')}:
${p('title')}: "Birth of <% tp.system.prompt("Person name?", "", false) %>"
${p('event_type')}: birth
${p('date')}: <% tp.system.prompt("Birth date (YYYY-MM-DD)?", "", false) %>
${p('date_precision')}: exact
${p('persons')}:
  - "[[<% tp.system.prompt("Person note name?", "", false) %>]]"
${p('place')}: "[[<% tp.system.prompt("Birth place?", "", false) %>]]"
${p('sources')}:
${p('confidence')}: <% tp.system.suggester(["High", "Medium", "Low", "Unknown"], ["high", "medium", "low", "unknown"]) %>
---

# Birth of <% tp.file.title %>

<% tp.file.cursor() %>`
			},
			{
				name: 'Marriage event',
				description: 'Template for recording a marriage event',
				template: `---
${p('cr_type')}: event
${p('cr_id')}:
${p('title')}: "Marriage of <% tp.system.prompt("Names (e.g., John Smith and Jane Doe)?", "", false) %>"
${p('event_type')}: marriage
${p('date')}: <% tp.system.prompt("Marriage date (YYYY-MM-DD)?", "", false) %>
${p('date_precision')}: exact
${p('persons')}:
  - "[[<% tp.system.prompt("First spouse note?", "", false) %>]]"
  - "[[<% tp.system.prompt("Second spouse note?", "", false) %>]]"
${p('place')}: "[[<% tp.system.prompt("Marriage location?", "", false) %>]]"
${p('sources')}:
${p('confidence')}: <% tp.system.suggester(["High", "Medium", "Low", "Unknown"], ["high", "medium", "low", "unknown"]) %>
---

# Marriage

<% tp.file.cursor() %>`
			},
			{
				name: 'Death event',
				description: 'Template for recording a death event',
				template: `---
${p('cr_type')}: event
${p('cr_id')}:
${p('title')}: "Death of <% tp.system.prompt("Person name?", "", false) %>"
${p('event_type')}: death
${p('date')}: <% tp.system.prompt("Death date (YYYY-MM-DD)?", "", false) %>
${p('date_precision')}: exact
${p('persons')}:
  - "[[<% tp.system.prompt("Person note name?", "", false) %>]]"
${p('place')}: "[[<% tp.system.prompt("Death place?", "", false) %>]]"
${p('sources')}:
${p('confidence')}: <% tp.system.suggester(["High", "Medium", "Low", "Unknown"], ["high", "medium", "low", "unknown"]) %>
---

# Death of <% tp.file.title %>

<% tp.file.cursor() %>`
			},
			{
				name: 'Narrative event',
				description: 'Template for worldbuilders and storytellers',
				template: `---
${p('cr_type')}: event
${p('cr_id')}:
${p('title')}: "<% tp.file.title %>"
${p('event_type')}: <% tp.system.suggester(["Anecdote", "Lore event", "Plot point", "Flashback", "Foreshadowing", "Backstory", "Climax", "Resolution"], ["anecdote", "lore_event", "plot_point", "flashback", "foreshadowing", "backstory", "climax", "resolution"]) %>
${p('date')}:
${p('date_precision')}: <% tp.system.suggester(["Exact date", "Year only", "Estimated", "Unknown"], ["exact", "year", "estimated", "unknown"]) %>
${p('persons')}:
  -
${p('place')}:
${p('is_canonical')}: <% tp.system.suggester(["Yes", "No"], [true, false]) %>
${p('universe')}: "<% tp.system.prompt("Universe/World name?", "", false) %>"
${p('confidence')}: medium
---

# <% tp.file.title %>

<% tp.file.cursor() %>`
			},
			{
				name: 'Relative-ordered event',
				description: 'Event without exact date, using relative ordering',
				template: `---
${p('cr_type')}: event
${p('cr_id')}:
${p('title')}: "<% tp.file.title %>"
${p('event_type')}: <% tp.system.suggester(["Anecdote", "Lore event", "Plot point", "Custom"], ["anecdote", "lore_event", "plot_point", "custom"]) %>
${p('date_precision')}: unknown
${p('persons')}:
  -
${p('place')}:
# Relative ordering - link to other event notes
${p('before')}:
  - "[[Event that happens after this one]]"
${p('after')}:
  - "[[Event that happens before this one]]"
${p('timeline')}: "[[Timeline Note]]"
${p('confidence')}: medium
---

# <% tp.file.title %>

## Description

<% tp.file.cursor() %>

## Notes

This event's position is determined by its relationships to other events, not by a specific date.`
			},
			{
				name: 'Full event note',
				description: 'Complete template with all event fields',
				template: `---
${p('cr_type')}: event
${p('cr_id')}:
${p('title')}: "<% tp.file.title %>"
${p('event_type')}: <% tp.system.suggester(["Birth", "Death", "Marriage", "Divorce", "Residence", "Occupation", "Military", "Immigration", "Education", "Burial", "Baptism", "Confirmation", "Ordination", "Anecdote", "Lore event", "Plot point", "Custom"], ["birth", "death", "marriage", "divorce", "residence", "occupation", "military", "immigration", "education", "burial", "baptism", "confirmation", "ordination", "anecdote", "lore_event", "plot_point", "custom"]) %>

# Date fields
${p('date')}:
${p('date_end')}:
${p('date_precision')}: <% tp.system.suggester(["Exact date", "Month only", "Year only", "Decade", "Estimated", "Date range", "Unknown"], ["exact", "month", "year", "decade", "estimated", "range", "unknown"]) %>
${p('date_system')}:

# People involved
${p('persons')}:
  -

# Location
${p('place')}:

# Sources
${p('sources')}:

# Confidence
${p('confidence')}: <% tp.system.suggester(["High", "Medium", "Low", "Unknown"], ["high", "medium", "low", "unknown"]) %>

# Description
${p('description')}:

# Worldbuilding (for narrative events)
${p('is_canonical')}:
${p('universe')}:

# Relative ordering
${p('before')}:
${p('after')}:
${p('timeline')}:
---

# <% tp.file.title %>

<% tp.file.cursor() %>`
			}
		];
	}
}
