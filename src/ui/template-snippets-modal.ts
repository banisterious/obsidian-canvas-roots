/**
 * Template Snippets Modal
 * Provides copyable Templater-compatible templates for person and place notes
 */

import { App, Modal, Notice } from 'obsidian';
import { createLucideIcon } from './lucide-icons';

type TemplateType = 'person' | 'place';

interface TemplateSnippet {
	name: string;
	description: string;
	template: string;
}

/**
 * Modal displaying copyable template snippets for Templater
 */
export class TemplateSnippetsModal extends Modal {
	private selectedType: TemplateType = 'person';

	constructor(app: App) {
		super(app);
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

		// Tab selector
		const tabContainer = contentEl.createDiv({ cls: 'crc-template-tabs' });

		const personTab = tabContainer.createEl('button', {
			text: 'Person notes',
			cls: 'crc-template-tab crc-template-tab--active'
		});
		const placeTab = tabContainer.createEl('button', {
			text: 'Place notes',
			cls: 'crc-template-tab'
		});

		// Template content container
		const templateContainer = contentEl.createDiv({ cls: 'crc-template-container' });

		// Tab switching
		personTab.addEventListener('click', () => {
			this.selectedType = 'person';
			personTab.addClass('crc-template-tab--active');
			placeTab.removeClass('crc-template-tab--active');
			this.renderTemplates(templateContainer);
		});

		placeTab.addEventListener('click', () => {
			this.selectedType = 'place';
			placeTab.addClass('crc-template-tab--active');
			personTab.removeClass('crc-template-tab--active');
			this.renderTemplates(templateContainer);
		});

		// Initial render
		this.renderTemplates(templateContainer);

		// Variable reference section
		const referenceSection = contentEl.createDiv({ cls: 'crc-template-reference crc-mt-4' });
		referenceSection.createEl('h4', { text: 'Templater variable reference', cls: 'crc-mb-2' });

		const referenceContent = referenceSection.createDiv({ cls: 'crc-template-reference-content' });
		this.renderVariableReference(referenceContent);

		// Schema documentation link
		const schemaSection = contentEl.createDiv({ cls: 'crc-template-schema-link crc-mt-3' });
		const schemaNote = schemaSection.createEl('p', { cls: 'crc-text--muted' });
		schemaNote.appendText('These templates include common fields. For the complete list of supported frontmatter properties, see the ');
		const schemaLink = schemaNote.createEl('a', {
			text: 'Frontmatter Schema Reference',
			cls: 'crc-link',
			href: 'https://github.com/banisterious/obsidian-canvas-roots/blob/main/docs/reference/frontmatter-schema.md'
		});
		schemaLink.setAttribute('target', '_blank');
		schemaNote.appendText('.');

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

		const templates = this.selectedType === 'person'
			? this.getPersonTemplates()
			: this.getPlaceTemplates();

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
			{ syntax: '<% tp.date.now("YYYYMMDDHHmmss") %>', description: 'Timestamp-based unique ID (for cr_id)' },
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
	 * Get person note templates
	 */
	private getPersonTemplates(): TemplateSnippet[] {
		return [
			{
				name: 'Basic person note',
				description: 'Minimal template with essential fields',
				template: `---
type: person
cr_id: <% tp.date.now("YYYYMMDDHHmmss") %>
name: "<% tp.file.title %>"
sex: <% tp.system.suggester(["Male", "Female", "Unknown"], ["M", "F", "U"]) %>
born:
died:
---

# <% tp.file.title %>

<% tp.file.cursor() %>`
			},
			{
				name: 'Full person note',
				description: 'Complete template with family relationships and place fields',
				template: `---
type: person
cr_id: <% tp.date.now("YYYYMMDDHHmmss") %>
name: "<% tp.file.title %>"
sex: <% tp.system.suggester(["Male", "Female", "Unknown"], ["M", "F", "U"]) %>

# Dates
born:
died:

# Family relationships
father:
father_id:
mother:
mother_id:
spouse1:
spouse1_id:
spouse1_marriage_date:
spouse1_marriage_location:

# Places
birth_place:
death_place:
burial_place:

# Organization
collection:
---

# <% tp.file.title %>

## Biography

<% tp.file.cursor() %>

## Notes

`
			},
			{
				name: 'Person with prompts',
				description: 'Interactive template that prompts for key information',
				template: `---
type: person
cr_id: <% tp.date.now("YYYYMMDDHHmmss") %>
name: "<% tp.file.title %>"
sex: <% tp.system.suggester(["Male", "Female", "Unknown"], ["M", "F", "U"]) %>
born: <% tp.system.prompt("Birth date (YYYY-MM-DD)?", "", false) %>
died: <% tp.system.prompt("Death date (YYYY-MM-DD)? Leave blank if living", "", false) %>
birth_place: "<% tp.system.prompt("Birth place?", "", false) %>"
---

# <% tp.file.title %>

<% tp.file.cursor() %>`
			}
		];
	}

	/**
	 * Get place note templates
	 */
	private getPlaceTemplates(): TemplateSnippet[] {
		return [
			{
				name: 'Basic place note',
				description: 'Minimal template for real-world locations',
				template: `---
type: place
cr_id: <% tp.date.now("YYYYMMDDHHmmss") %>
name: "<% tp.file.title %>"
place_type: <% tp.system.suggester(["City", "Town", "Village", "Country", "State/Province", "Region", "County"], ["city", "town", "village", "country", "state", "region", "county"]) %>
parent_place:
---

# <% tp.file.title %>

<% tp.file.cursor() %>`
			},
			{
				name: 'Place with coordinates',
				description: 'For real-world locations with geographic coordinates',
				template: `---
type: place
cr_id: <% tp.date.now("YYYYMMDDHHmmss") %>
name: "<% tp.file.title %>"
place_category: real
place_type: <% tp.system.suggester(["City", "Town", "Village", "Country", "State/Province", "Region", "County"], ["city", "town", "village", "country", "state", "region", "county"]) %>
parent_place:
coordinates:
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
type: place
cr_id: <% tp.date.now("YYYYMMDDHHmmss") %>
name: "<% tp.file.title %>"
place_category: historical
place_type: <% tp.system.suggester(["City", "Town", "Village", "Country", "State/Province", "Region", "Kingdom", "Empire"], ["city", "town", "village", "country", "state", "region", "kingdom", "empire"]) %>
parent_place:
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
type: place
cr_id: <% tp.date.now("YYYYMMDDHHmmss") %>
name: "<% tp.file.title %>"
place_category: fictional
universe: "<% tp.system.prompt("Universe/World name?", "", false) %>"
place_type: <% tp.system.suggester(["City", "Town", "Village", "Country", "Kingdom", "Region", "Castle", "Fortress", "Island"], ["city", "town", "village", "country", "kingdom", "region", "castle", "fortress", "island"]) %>
parent_place:
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
type: place
cr_id: <% tp.date.now("YYYYMMDDHHmmss") %>
name: "<% tp.file.title %>"
aliases:
  -
place_category: <% tp.system.suggester(["Real", "Historical", "Disputed", "Legendary", "Mythological", "Fictional"], ["real", "historical", "disputed", "legendary", "mythological", "fictional"]) %>
universe:
place_type: <% tp.system.suggester(["City", "Town", "Village", "Country", "State/Province", "Region", "County", "Kingdom", "Castle"], ["city", "town", "village", "country", "state", "region", "county", "kingdom", "castle"]) %>
parent_place:
coordinates:
  lat:
  long:
custom_coordinates:
  x:
  y:
  map:
historical_names:
  - name:
    period:
collection:
---

# <% tp.file.title %>

<% tp.file.cursor() %>`
			}
		];
	}
}
