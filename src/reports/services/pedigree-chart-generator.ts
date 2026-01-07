/**
 * Pedigree Chart Generator
 *
 * Generates a pedigree chart showing ancestors in a tree format.
 * Uses ASCII/Unicode art to create a visual representation in markdown.
 */

import { App } from 'obsidian';
import type { CanvasRootsSettings } from '../../settings';
import type {
	PedigreeChartOptions,
	PedigreeChartResult,
	ReportPerson
} from '../types/report-types';
import { FamilyGraphService, PersonNode } from '../../core/family-graph';
import { FolderFilterService } from '../../core/folder-filter';
import { getLogger } from '../../core/logging';

const logger = getLogger('PedigreeChartGenerator');

/**
 * Generator for Pedigree Charts
 */
export class PedigreeChartGenerator {
	private app: App;
	private settings: CanvasRootsSettings;

	constructor(app: App, settings: CanvasRootsSettings) {
		this.app = app;
		this.settings = settings;
	}

	/**
	 * Generate a Pedigree Chart
	 */
	async generate(options: PedigreeChartOptions): Promise<PedigreeChartResult> {
		await Promise.resolve(); // Satisfy async requirement
		logger.info('generate', 'Generating Pedigree Chart', {
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
				suggestedFilename: 'pedigree-chart.md',
				stats: { peopleCount: 0, eventsCount: 0, sourcesCount: 0, generationsCount: 0 },
				error: `Person not found: ${options.rootPersonCrId}`,
				warnings: [],
				rootPerson: { crId: '', name: 'Unknown', filePath: '' },
				treeContent: ''
			};
		}

		const rootPerson = this.nodeToReportPerson(rootNode);

		// Build ancestor map using Sosa-Stradonitz numbering
		const ancestors = new Map<number, ReportPerson>();
		this.collectAncestors(1, rootNode, ancestors, familyGraph, options.maxGenerations, 1);

		// Calculate actual generations found
		let maxGenFound = 1;
		for (const num of ancestors.keys()) {
			const gen = Math.floor(Math.log2(num)) + 1;
			if (gen > maxGenFound) maxGenFound = gen;
		}

		// Generate the tree content
		const treeContent = this.buildTree(ancestors, options);

		// Generate full markdown content
		const content = this.generateMarkdown(rootPerson, ancestors, treeContent, options, maxGenFound);

		const suggestedFilename = `Pedigree Chart - ${rootPerson.name}.md`;

		return {
			success: true,
			content,
			suggestedFilename: this.sanitizeFilename(suggestedFilename),
			stats: {
				peopleCount: ancestors.size,
				eventsCount: 0,
				sourcesCount: 0,
				generationsCount: maxGenFound
			},
			warnings,
			rootPerson,
			treeContent
		};
	}

	/**
	 * Recursively collect ancestors with Sosa-Stradonitz numbers
	 */
	private collectAncestors(
		sosaNumber: number,
		node: PersonNode,
		ancestors: Map<number, ReportPerson>,
		familyGraph: FamilyGraphService,
		maxGenerations: number,
		currentGeneration: number
	): void {
		ancestors.set(sosaNumber, this.nodeToReportPerson(node));

		if (currentGeneration >= maxGenerations) {
			return;
		}

		// Father is 2n
		if (node.fatherCrId) {
			const father = familyGraph.getPersonByCrId(node.fatherCrId);
			if (father) {
				this.collectAncestors(
					sosaNumber * 2,
					father,
					ancestors,
					familyGraph,
					maxGenerations,
					currentGeneration + 1
				);
			}
		}

		// Mother is 2n+1
		if (node.motherCrId) {
			const mother = familyGraph.getPersonByCrId(node.motherCrId);
			if (mother) {
				this.collectAncestors(
					sosaNumber * 2 + 1,
					mother,
					ancestors,
					familyGraph,
					maxGenerations,
					currentGeneration + 1
				);
			}
		}
	}

	/**
	 * Build the ASCII tree representation
	 */
	private buildTree(ancestors: Map<number, ReportPerson>, options: PedigreeChartOptions): string {
		const lines: string[] = [];

		// We'll build the tree generation by generation, right to left
		// (oldest ancestors on the right, subject on the left)

		// Calculate layout dimensions
		// Each generation takes a certain amount of vertical space
		// Gen 1 (subject): 1 line
		// Gen 2 (parents): 2 lines
		// Gen 3 (grandparents): 4 lines
		// etc.

		// For a cleaner presentation, we'll use a different approach:
		// Build the tree as an indented list where each level shows parents

		lines.push('```');
		lines.push(this.buildTreeNode(1, ancestors, options, 0, '', ''));
		lines.push('```');

		return lines.join('\n');
	}

	/**
	 * Recursively build tree node representation
	 */
	private buildTreeNode(
		sosaNum: number,
		ancestors: Map<number, ReportPerson>,
		options: PedigreeChartOptions,
		depth: number,
		linePrefix: string,
		connector: string
	): string {
		const person = ancestors.get(sosaNum);
		if (!person) {
			return `${linePrefix}${connector}[Unknown]`;
		}

		const lines: string[] = [];

		// Format person name with dates if requested
		let personLine = person.name;
		if (options.includeDetails) {
			const dates: string[] = [];
			if (person.birthDate) dates.push(`b. ${person.birthDate}`);
			if (person.deathDate) dates.push(`d. ${person.deathDate}`);
			if (dates.length > 0) {
				personLine += ` (${dates.join(', ')})`;
			}
		}

		lines.push(`${linePrefix}${connector}${personLine}`);

		// Check if this is the last generation
		const currentGen = Math.floor(Math.log2(sosaNum)) + 1;
		if (currentGen >= options.maxGenerations) {
			return lines.join('\n');
		}

		// Add father (2n) and mother (2n+1)
		const fatherNum = sosaNum * 2;
		const motherNum = sosaNum * 2 + 1;
		const hasFather = ancestors.has(fatherNum);
		const hasMother = ancestors.has(motherNum);

		if (hasFather || hasMother) {
			// Calculate the new prefix for children
			// If we used ├── connector, continue with │, otherwise use space
			const newLinePrefix = linePrefix + (connector === '├── ' ? '│   ' : '    ');

			if (hasFather) {
				const fatherConnector = hasMother ? '├── ' : '└── ';
				lines.push(this.buildTreeNode(fatherNum, ancestors, options, depth + 1, newLinePrefix, fatherConnector));
			}

			if (hasMother) {
				lines.push(this.buildTreeNode(motherNum, ancestors, options, depth + 1, newLinePrefix, '└── '));
			}
		}

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
			pronouns: node.pronouns,
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
			case 1: return 'Self';
			case 2: return 'Parents';
			case 3: return 'Grandparents';
			case 4: return 'Great-grandparents';
			case 5: return '2nd great-grandparents';
			case 6: return '3rd great-grandparents';
			default: return `${generation - 2}th great-grandparents`;
		}
	}

	/**
	 * Generate markdown content for the Pedigree Chart
	 */
	private generateMarkdown(
		rootPerson: ReportPerson,
		ancestors: Map<number, ReportPerson>,
		treeContent: string,
		options: PedigreeChartOptions,
		maxGenFound: number
	): string {
		const lines: string[] = [];

		// Title
		lines.push(`# Pedigree Chart: ${rootPerson.name}`);
		lines.push('');
		lines.push(`Ancestors traced through ${maxGenFound} generation${maxGenFound > 1 ? 's' : ''}.`);
		lines.push('');

		// Tree visualization
		lines.push('## Ancestor Tree');
		lines.push('');
		lines.push(treeContent);
		lines.push('');

		// Detailed list by generation
		lines.push('## Ancestors by Generation');
		lines.push('');

		for (let gen = 1; gen <= maxGenFound; gen++) {
			const genStart = Math.pow(2, gen - 1);
			const genEnd = Math.pow(2, gen) - 1;

			// Collect ancestors in this generation
			const genAncestors: Array<{ num: number; person: ReportPerson }> = [];
			for (let num = genStart; num <= genEnd; num++) {
				const person = ancestors.get(num);
				if (person) {
					genAncestors.push({ num, person });
				}
			}

			if (genAncestors.length === 0) continue;

			lines.push(`### Generation ${gen}: ${this.getGenerationLabel(gen)}`);
			lines.push('');

			for (const { num, person } of genAncestors) {
				const relationship = this.getSosaRelationship(num);
				lines.push(`**${num}. [[${person.name}]]** — ${relationship}`);

				if (options.includeDetails) {
					if (person.birthDate || person.birthPlace) {
						const birthParts = [person.birthDate, person.birthPlace].filter(Boolean);
						lines.push(`- Born: ${birthParts.join(', ')}`);
					}
					if (person.deathDate || person.deathPlace) {
						const deathParts = [person.deathDate, person.deathPlace].filter(Boolean);
						lines.push(`- Died: ${deathParts.join(', ')}`);
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
		lines.push(`- **Subject:** ${rootPerson.name}`);
		lines.push(`- **Total ancestors found:** ${ancestors.size}`);
		lines.push(`- **Generations traced:** ${maxGenFound}`);

		// Completeness by generation
		lines.push('- **Completeness by generation:**');
		for (let gen = 2; gen <= maxGenFound; gen++) {
			const expected = Math.pow(2, gen - 1);
			const genStart = Math.pow(2, gen - 1);
			const genEnd = Math.pow(2, gen) - 1;
			let found = 0;
			for (let num = genStart; num <= genEnd; num++) {
				if (ancestors.has(num)) found++;
			}
			const percent = Math.round((found / expected) * 100);
			lines.push(`  - ${this.getGenerationLabel(gen)}: ${found}/${expected} (${percent}%)`);
		}
		lines.push('');

		// Footer
		lines.push('---');
		lines.push('*Generated by Canvas Roots*');

		return lines.join('\n');
	}

	/**
	 * Get relationship name from Sosa-Stradonitz number
	 */
	private getSosaRelationship(sosaNum: number): string {
		if (sosaNum === 1) return 'Self';
		if (sosaNum === 2) return 'Father';
		if (sosaNum === 3) return 'Mother';

		// Build path from root
		const path: string[] = [];
		let num = sosaNum;

		while (num > 1) {
			if (num % 2 === 0) {
				path.unshift('father');
			} else {
				path.unshift('mother');
			}
			num = Math.floor(num / 2);
		}

		// Determine the base relationship
		const lastRelation = path[path.length - 1];
		const greats = path.length - 2;

		if (greats < 0) {
			return lastRelation === 'father' ? 'Father' : 'Mother';
		} else if (greats === 0) {
			return lastRelation === 'father' ? 'Grandfather' : 'Grandmother';
		} else if (greats === 1) {
			return lastRelation === 'father' ? 'Great-grandfather' : 'Great-grandmother';
		} else {
			const ordinal = greats === 2 ? '2nd' : greats === 3 ? '3rd' : `${greats}th`;
			return lastRelation === 'father'
				? `${ordinal} great-grandfather`
				: `${ordinal} great-grandmother`;
		}
	}

	/**
	 * Sanitize a filename by removing invalid characters
	 */
	private sanitizeFilename(filename: string): string {
		return filename.replace(/[<>:"/\\|?*]/g, '-');
	}
}
