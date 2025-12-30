/**
 * Relationships Renderer
 *
 * Renders relationships HTML for the canvas-roots-relationships code block.
 * Creates grouped sections for family relationships with wikilinks.
 */

import { MarkdownRenderer, MarkdownRenderChild } from 'obsidian';
import type { DynamicBlockContext, DynamicBlockConfig, DynamicContentService } from '../services/dynamic-content-service';
import type { PersonNode, FamilyGraphService } from '../../core/family-graph';

/**
 * Relationship entry for rendering
 */
interface RelationshipEntry {
	name: string;
	filePath?: string;
	dates?: string;
}

/**
 * Grouped relationships for display
 */
interface RelationshipGroups {
	parents: RelationshipEntry[];
	spouse: RelationshipEntry[];
	children: RelationshipEntry[];
	siblings: RelationshipEntry[];
}

/**
 * Renders relationships content into an HTML element
 */
export class RelationshipsRenderer {
	private service: DynamicContentService;
	/** Store groups for freeze functionality */
	private currentGroups: RelationshipGroups | null = null;
	private currentContext: DynamicBlockContext | null = null;
	private currentConfig: DynamicBlockConfig | null = null;

	constructor(service: DynamicContentService) {
		this.service = service;
	}

	/**
	 * Render the relationships block
	 */
	async render(
		el: HTMLElement,
		context: DynamicBlockContext,
		config: DynamicBlockConfig,
		component: MarkdownRenderChild
	): Promise<void> {
		const container = el.createDiv({ cls: 'cr-dynamic-block cr-relationships' });

		// Build relationship groups
		const groups = this.buildRelationshipGroups(context, config);

		// Store for freeze functionality
		this.currentGroups = groups;
		this.currentContext = context;
		this.currentConfig = config;

		// Render header (needs groups for freeze)
		this.renderHeader(container, config);

		// Render content
		const contentEl = container.createDiv({ cls: 'cr-dynamic-block__content' });

		const isEmpty = groups.parents.length === 0 &&
			groups.spouse.length === 0 &&
			groups.children.length === 0 &&
			groups.siblings.length === 0;

		if (isEmpty) {
			contentEl.createDiv({
				cls: 'cr-dynamic-block__empty',
				text: 'No family relationships found.'
			});
			return;
		}

		// Render each section
		await this.renderSections(contentEl, groups, context, config, component);
	}

	/**
	 * Render the header with title and toolbar
	 */
	private renderHeader(container: HTMLElement, config: DynamicBlockConfig): void {
		const header = container.createDiv({ cls: 'cr-dynamic-block__header' });

		const title = config.title as string || 'Family';
		header.createSpan({ cls: 'cr-dynamic-block__title', text: title });

		const toolbar = header.createDiv({ cls: 'cr-dynamic-block__toolbar' });

		// Freeze button
		const freezeBtn = toolbar.createEl('button', {
			cls: 'cr-dynamic-block__btn clickable-icon',
			attr: { 'aria-label': 'Freeze to markdown' }
		});
		freezeBtn.textContent = '❄️';
		freezeBtn.addEventListener('click', () => {
			void this.freezeToMarkdown();
		});
	}

	/**
	 * Build relationship groups from person data
	 */
	private buildRelationshipGroups(
		context: DynamicBlockContext,
		config: DynamicBlockConfig
	): RelationshipGroups {
		const { person, familyGraph } = context;

		const groups: RelationshipGroups = {
			parents: [],
			spouse: [],
			children: [],
			siblings: []
		};

		if (!person) {
			return groups;
		}

		// Check what relationship types to include
		const include = config.include as string[] | undefined;
		const shouldInclude = (type: string): boolean => {
			if (!include || include.length === 0) return true;
			return include.includes(type);
		};

		// Parents
		if (shouldInclude('parents')) {
			if (person.fatherCrId) {
				const father = familyGraph.getPersonByCrId(person.fatherCrId);
				if (father) {
					groups.parents.push(this.personToEntry(father, 'Father'));
				}
			}
			if (person.motherCrId) {
				const mother = familyGraph.getPersonByCrId(person.motherCrId);
				if (mother) {
					groups.parents.push(this.personToEntry(mother, 'Mother'));
				}
			}
			// Gender-neutral parents
			for (const parentCrId of person.parentCrIds) {
				const parent = familyGraph.getPersonByCrId(parentCrId);
				if (parent) {
					groups.parents.push(this.personToEntry(parent, 'Parent'));
				}
			}
		}

		// Spouses
		if (shouldInclude('spouse') && person.spouseCrIds.length > 0) {
			for (const spouseCrId of person.spouseCrIds) {
				const spouse = familyGraph.getPersonByCrId(spouseCrId);
				if (spouse) {
					groups.spouse.push(this.personToEntry(spouse));
				}
			}
		}

		// Children
		if (shouldInclude('children') && person.childrenCrIds.length > 0) {
			for (const childCrId of person.childrenCrIds) {
				const child = familyGraph.getPersonByCrId(childCrId);
				if (child) {
					groups.children.push(this.personToEntry(child));
				}
			}
		}

		// Siblings (computed from shared parents)
		if (shouldInclude('siblings')) {
			const siblingCrIds = this.findSiblings(person, familyGraph);
			for (const siblingCrId of siblingCrIds) {
				const sibling = familyGraph.getPersonByCrId(siblingCrId);
				if (sibling) {
					groups.siblings.push(this.personToEntry(sibling));
				}
			}
		}

		return groups;
	}

	/**
	 * Convert a PersonNode to a RelationshipEntry
	 */
	private personToEntry(person: PersonNode, label?: string): RelationshipEntry {
		const entry: RelationshipEntry = {
			name: person.name,
			filePath: person.file?.path
		};

		// Add dates if available
		if (person.birthDate || person.deathDate) {
			const birth = person.birthDate ? this.extractYear(person.birthDate) : '?';
			const death = person.deathDate ? this.extractYear(person.deathDate) : '';
			entry.dates = death ? `(${birth}–${death})` : `(b. ${birth})`;
		}

		// Prepend label if provided
		if (label) {
			entry.name = `${label}: ${person.name}`;
		}

		return entry;
	}

	/**
	 * Find siblings of a person (people who share at least one parent)
	 */
	private findSiblings(person: PersonNode, familyGraph: FamilyGraphService): string[] {
		const siblings = new Set<string>();

		// Get all children of the father
		if (person.fatherCrId) {
			const father = familyGraph.getPersonByCrId(person.fatherCrId);
			if (father) {
				for (const childCrId of father.childrenCrIds) {
					if (childCrId !== person.crId) {
						siblings.add(childCrId);
					}
				}
			}
		}

		// Get all children of the mother
		if (person.motherCrId) {
			const mother = familyGraph.getPersonByCrId(person.motherCrId);
			if (mother) {
				for (const childCrId of mother.childrenCrIds) {
					if (childCrId !== person.crId) {
						siblings.add(childCrId);
					}
				}
			}
		}

		// Get all children of gender-neutral parents
		for (const parentCrId of person.parentCrIds) {
			const parent = familyGraph.getPersonByCrId(parentCrId);
			if (parent) {
				for (const childCrId of parent.childrenCrIds) {
					if (childCrId !== person.crId) {
						siblings.add(childCrId);
					}
				}
			}
		}

		return Array.from(siblings);
	}

	/**
	 * Extract year from a date string
	 */
	private extractYear(dateStr: string): string {
		const yearMatch = dateStr.match(/\b(\d{4})\b/);
		return yearMatch ? yearMatch[1] : dateStr;
	}

	/**
	 * Render all relationship sections
	 */
	private async renderSections(
		contentEl: HTMLElement,
		groups: RelationshipGroups,
		context: DynamicBlockContext,
		config: DynamicBlockConfig,
		component: MarkdownRenderChild
	): Promise<void> {
		// Define section order and labels
		const sections: { key: keyof RelationshipGroups; label: string }[] = [
			{ key: 'parents', label: 'Parents' },
			{ key: 'spouse', label: 'Spouse' },
			{ key: 'children', label: 'Children' },
			{ key: 'siblings', label: 'Siblings' }
		];

		// Check config for display type
		const displayType = config.type as string || 'immediate';

		for (const section of sections) {
			const entries = groups[section.key];
			if (entries.length === 0) continue;

			// Skip siblings in 'immediate' type (parents, spouse, children only)
			if (displayType === 'immediate' && section.key === 'siblings') {
				continue;
			}

			await this.renderSection(contentEl, section.label, entries, context, component);
		}
	}

	/**
	 * Render a single relationship section
	 */
	private async renderSection(
		contentEl: HTMLElement,
		label: string,
		entries: RelationshipEntry[],
		context: DynamicBlockContext,
		component: MarkdownRenderChild
	): Promise<void> {
		const section = contentEl.createDiv({ cls: 'cr-relationships__section' });

		// Section heading
		section.createEl('h4', { cls: 'cr-relationships__heading', text: label });

		// List of entries
		const list = section.createEl('ul', { cls: 'cr-relationships__list' });

		for (const entry of entries) {
			const li = list.createEl('li', { cls: 'cr-relationships__item' });

			// Render as wikilink if we have a file path
			if (entry.filePath) {
				const linkEl = li.createSpan({ cls: 'cr-relationships__link' });
				const basename = entry.filePath.replace(/\.md$/, '').split('/').pop() || entry.name;
				// Use alias format if basename differs from name (duplicate handling)
				const wikilink = basename !== entry.name ? `[[${basename}|${entry.name}]]` : `[[${basename}]]`;
				await MarkdownRenderer.render(
					context.familyGraph['app'],
					wikilink,
					linkEl,
					context.file.path,
					component
				);
			} else {
				li.createSpan({ cls: 'cr-relationships__name', text: entry.name });
			}

			// Dates
			if (entry.dates) {
				li.createSpan({ cls: 'cr-relationships__dates', text: ` ${entry.dates}` });
			}
		}
	}

	/**
	 * Generate markdown from current groups and replace the code block
	 */
	private async freezeToMarkdown(): Promise<void> {
		if (!this.currentContext || !this.currentGroups) {
			return;
		}

		const markdown = this.generateMarkdown();
		await this.service.freezeToMarkdown(
			this.currentContext.file,
			'canvas-roots-relationships',
			markdown
		);
	}

	/**
	 * Generate markdown representation of the relationships
	 */
	private generateMarkdown(): string {
		if (!this.currentGroups || !this.currentConfig) {
			return '';
		}

		const lines: string[] = ['## Family', ''];

		// Define section order and labels
		const sections: { key: keyof RelationshipGroups; label: string }[] = [
			{ key: 'parents', label: 'Parents' },
			{ key: 'spouse', label: 'Spouse' },
			{ key: 'children', label: 'Children' },
			{ key: 'siblings', label: 'Siblings' }
		];

		// Check config for display type
		const displayType = this.currentConfig.type as string || 'immediate';

		for (const section of sections) {
			const entries = this.currentGroups[section.key];
			if (entries.length === 0) continue;

			// Skip siblings in 'immediate' type
			if (displayType === 'immediate' && section.key === 'siblings') {
				continue;
			}

			lines.push(`### ${section.label}`);
			lines.push('');

			for (const entry of entries) {
				let line = '- ';

				// Add wikilink if we have a file path
				if (entry.filePath) {
					const basename = entry.filePath.replace(/\.md$/, '').split('/').pop() || entry.name;
					// Use alias format if basename differs from name (duplicate handling)
					line += basename !== entry.name ? `[[${basename}|${entry.name}]]` : `[[${basename}]]`;
				} else {
					line += entry.name;
				}

				// Add dates
				if (entry.dates) {
					line += ` ${entry.dates}`;
				}

				lines.push(line);
			}

			lines.push('');
		}

		return lines.join('\n').trim();
	}
}
