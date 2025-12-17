/**
 * Descendant Chart Generator
 *
 * Generates a descendant chart showing all descendants in a tree format.
 * Uses ASCII/Unicode art to create a visual representation in markdown.
 */

import { App } from 'obsidian';
import type { CanvasRootsSettings } from '../../settings';
import type {
	DescendantChartOptions,
	DescendantChartResult,
	DescendantEntry,
	ReportPerson
} from '../types/report-types';
import { FamilyGraphService, PersonNode } from '../../core/family-graph';
import { FolderFilterService } from '../../core/folder-filter';
import { getLogger } from '../../core/logging';

const logger = getLogger('DescendantChartGenerator');

/**
 * Generator for Descendant Charts
 */
export class DescendantChartGenerator {
	private app: App;
	private settings: CanvasRootsSettings;

	constructor(app: App, settings: CanvasRootsSettings) {
		this.app = app;
		this.settings = settings;
	}

	/**
	 * Generate a Descendant Chart
	 */
	async generate(options: DescendantChartOptions): Promise<DescendantChartResult> {
		await Promise.resolve(); // Satisfy async requirement
		logger.info('generate', 'Generating Descendant Chart', {
			rootPersonCrId: options.rootPersonCrId,
			maxGenerations: options.maxGenerations
		});

		const warnings: string[] = [];

		// Initialize family graph service
		const familyGraph = new FamilyGraphService(this.app);
		if (this.settings.folderFilterMode !== 'disabled') {
			familyGraph.setFolderFilter(new FolderFilterService(this.settings));
		}
		familyGraph.setPropertyAliases(this.settings.propertyAliases);
		familyGraph.setValueAliases(this.settings.valueAliases);
		familyGraph.setSettings(this.settings);
		familyGraph.ensureCacheLoaded();

		// Get the root person
		const rootNode = familyGraph.getPersonByCrId(options.rootPersonCrId);
		if (!rootNode) {
			return {
				success: false,
				content: '',
				suggestedFilename: 'descendant-chart.md',
				stats: { peopleCount: 0, eventsCount: 0, sourcesCount: 0, generationsCount: 0 },
				error: `Person not found: ${options.rootPersonCrId}`,
				warnings: [],
				rootPerson: { crId: '', name: 'Unknown', filePath: '' },
				entries: []
			};
		}

		const rootPerson = this.nodeToReportPerson(rootNode);

		// Build descendant entries
		const entries: DescendantEntry[] = [];
		this.collectDescendants(rootNode, familyGraph, entries, 0, options);

		// Calculate generations found
		let maxGenFound = 0;
		for (const entry of entries) {
			if (entry.level > maxGenFound) {
				maxGenFound = entry.level;
			}
		}
		maxGenFound++; // Convert from 0-based level to 1-based generation

		// Generate the tree content
		const treeContent = this.buildTree(entries, options);

		// Generate full markdown content
		const content = this.generateMarkdown(rootPerson, entries, treeContent, options, maxGenFound);

		const suggestedFilename = `Descendant Chart - ${rootPerson.name}.md`;

		return {
			success: true,
			content,
			suggestedFilename: this.sanitizeFilename(suggestedFilename),
			stats: {
				peopleCount: entries.length,
				eventsCount: 0,
				sourcesCount: 0,
				generationsCount: maxGenFound
			},
			warnings,
			rootPerson,
			entries
		};
	}

	/**
	 * Recursively collect descendants
	 */
	private collectDescendants(
		node: PersonNode,
		familyGraph: FamilyGraphService,
		entries: DescendantEntry[],
		level: number,
		options: DescendantChartOptions
	): void {
		// Check generation limit (level is 0-based, maxGenerations is 1-based)
		if (level >= options.maxGenerations) {
			return;
		}

		// Get spouses
		const spouses: ReportPerson[] = [];
		if (options.includeSpouses) {
			for (const spouseCrId of node.spouseCrIds) {
				const spouseNode = familyGraph.getPersonByCrId(spouseCrId);
				if (spouseNode) {
					spouses.push(this.nodeToReportPerson(spouseNode));
				}
			}
		}

		// Add this person as an entry
		entries.push({
			person: this.nodeToReportPerson(node),
			level,
			spouses
		});

		// Get children sorted by birth date
		const children: PersonNode[] = [];
		for (const childCrId of node.childrenCrIds) {
			const childNode = familyGraph.getPersonByCrId(childCrId);
			if (childNode) {
				children.push(childNode);
			}
		}

		// Sort by birth date
		children.sort((a, b) => {
			if (!a.birthDate && !b.birthDate) return 0;
			if (!a.birthDate) return 1;
			if (!b.birthDate) return -1;
			return a.birthDate.localeCompare(b.birthDate);
		});

		// Recursively process children
		for (const child of children) {
			this.collectDescendants(child, familyGraph, entries, level + 1, options);
		}
	}

	/**
	 * Build the ASCII tree representation
	 */
	private buildTree(entries: DescendantEntry[], options: DescendantChartOptions): string {
		const lines: string[] = [];

		lines.push('```');

		// Track the tree structure for proper connectors
		// We need to know for each level whether there are more siblings coming
		const levelHasMore: boolean[] = [];

		for (let i = 0; i < entries.length; i++) {
			const entry = entries[i];
			const nextEntry = entries[i + 1];

			// Determine if this is the last child at this level
			const isLast = !nextEntry || nextEntry.level <= entry.level;

			// Update the levelHasMore array
			while (levelHasMore.length <= entry.level) {
				levelHasMore.push(false);
			}
			levelHasMore[entry.level] = !isLast;

			// Build the prefix
			let prefix = '';
			for (let j = 0; j < entry.level; j++) {
				if (j === entry.level - 1) {
					// This is the immediate connector
					prefix += isLast ? '└── ' : '├── ';
				} else {
					// Check if there are more items at this level
					prefix += levelHasMore[j] ? '│   ' : '    ';
				}
			}

			// Format person name with dates if requested
			let personLine = entry.person.name;
			if (options.includeDetails) {
				const dates: string[] = [];
				if (entry.person.birthDate) dates.push(`b. ${entry.person.birthDate}`);
				if (entry.person.deathDate) dates.push(`d. ${entry.person.deathDate}`);
				if (dates.length > 0) {
					personLine += ` (${dates.join(', ')})`;
				}
			}

			// Add spouse info if requested
			if (options.includeSpouses && entry.spouses.length > 0) {
				const spouseNames = entry.spouses.map(s => s.name).join(', ');
				personLine += ` ⚭ ${spouseNames}`;
			}

			lines.push(`${prefix}${personLine}`);
		}

		lines.push('```');

		return lines.join('\n');
	}

	/**
	 * Convert a PersonNode to ReportPerson
	 */
	private nodeToReportPerson(node: PersonNode): ReportPerson {
		return {
			crId: node.crId,
			name: node.name,
			birthDate: node.birthDate,
			birthPlace: node.birthPlace,
			deathDate: node.deathDate,
			deathPlace: node.deathPlace,
			sex: this.normalizeSex(node.sex),
			occupation: node.occupation,
			filePath: node.file.path
		};
	}

	/**
	 * Normalize sex value to expected type
	 */
	private normalizeSex(sex?: string): 'male' | 'female' | 'other' | 'unknown' | undefined {
		if (!sex) return undefined;
		const lower = sex.toLowerCase();
		if (lower === 'male' || lower === 'm') return 'male';
		if (lower === 'female' || lower === 'f') return 'female';
		if (lower === 'other') return 'other';
		return 'unknown';
	}

	/**
	 * Get generation label
	 */
	private getGenerationLabel(generation: number): string {
		switch (generation) {
			case 1: return 'Progenitor';
			case 2: return 'Children';
			case 3: return 'Grandchildren';
			case 4: return 'Great-grandchildren';
			case 5: return '2nd great-grandchildren';
			case 6: return '3rd great-grandchildren';
			default: return `${generation - 2}th great-grandchildren`;
		}
	}

	/**
	 * Generate markdown content for the Descendant Chart
	 */
	private generateMarkdown(
		rootPerson: ReportPerson,
		entries: DescendantEntry[],
		treeContent: string,
		options: DescendantChartOptions,
		maxGenFound: number
	): string {
		const lines: string[] = [];

		// Title
		lines.push(`# Descendant Chart: ${rootPerson.name}`);
		lines.push('');
		lines.push(`Descendants traced through ${maxGenFound} generation${maxGenFound > 1 ? 's' : ''}.`);
		lines.push('');

		// Tree visualization
		lines.push('## Descendant Tree');
		lines.push('');
		lines.push(treeContent);
		lines.push('');

		// Detailed list by generation
		lines.push('## Descendants by Generation');
		lines.push('');

		for (let gen = 0; gen < maxGenFound; gen++) {
			const genEntries = entries.filter(e => e.level === gen);
			if (genEntries.length === 0) continue;

			lines.push(`### Generation ${gen + 1}: ${this.getGenerationLabel(gen + 1)}`);
			lines.push('');

			for (const entry of genEntries) {
				lines.push(`**[[${entry.person.name}]]**`);

				if (options.includeDetails) {
					if (entry.person.birthDate || entry.person.birthPlace) {
						const birthParts = [entry.person.birthDate, entry.person.birthPlace].filter(Boolean);
						lines.push(`- Born: ${birthParts.join(', ')}`);
					}
					if (entry.person.deathDate || entry.person.deathPlace) {
						const deathParts = [entry.person.deathDate, entry.person.deathPlace].filter(Boolean);
						lines.push(`- Died: ${deathParts.join(', ')}`);
					}
					if (entry.person.occupation) {
						lines.push(`- Occupation: ${entry.person.occupation}`);
					}
				}

				if (options.includeSpouses && entry.spouses.length > 0) {
					for (const spouse of entry.spouses) {
						lines.push(`- Married: [[${spouse.name}]]`);
					}
				}

				lines.push('');
			}
		}

		// Summary statistics
		lines.push('---');
		lines.push('');
		lines.push('## Summary');
		lines.push('');
		lines.push(`- **Progenitor:** ${rootPerson.name}`);
		lines.push(`- **Total descendants:** ${entries.length}`);
		lines.push(`- **Generations:** ${maxGenFound}`);

		// Count by generation
		lines.push('- **By generation:**');
		for (let gen = 0; gen < maxGenFound; gen++) {
			const count = entries.filter(e => e.level === gen).length;
			lines.push(`  - ${this.getGenerationLabel(gen + 1)}: ${count}`);
		}
		lines.push('');

		// Footer
		lines.push('---');
		lines.push('*Generated by Canvas Roots*');

		return lines.join('\n');
	}

	/**
	 * Sanitize a filename by removing invalid characters
	 */
	private sanitizeFilename(filename: string): string {
		return filename.replace(/[<>:"/\\|?*]/g, '-');
	}
}
