/**
 * Ahnentafel Generator
 *
 * Generates an Ahnentafel (ancestor table) report using Sosa-Stradonitz numbering.
 * 1 = subject, 2 = father, 3 = mother, 4 = paternal grandfather, etc.
 */

import { App } from 'obsidian';
import type { CanvasRootsSettings } from '../../settings';
import type {
	AhnentafelOptions,
	AhnentafelResult,
	ReportPerson
} from '../types/report-types';
import { FamilyGraphService, PersonNode } from '../../core/family-graph';
import { FolderFilterService } from '../../core/folder-filter';
import { getLogger } from '../../core/logging';

const logger = getLogger('AhnentafelGenerator');

/**
 * Generator for Ahnentafel reports
 */
export class AhnentafelGenerator {
	private app: App;
	private settings: CanvasRootsSettings;

	constructor(app: App, settings: CanvasRootsSettings) {
		this.app = app;
		this.settings = settings;
	}

	/**
	 * Generate an Ahnentafel report
	 */
	async generate(options: AhnentafelOptions): Promise<AhnentafelResult> {
		logger.info('generate', 'Generating Ahnentafel', {
			rootPersonCrId: options.rootPersonCrId,
			maxGenerations: options.maxGenerations
		});

		const warnings: string[] = [];
		const ancestors = new Map<number, ReportPerson>();

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
				suggestedFilename: 'ahnentafel.md',
				stats: { peopleCount: 0, eventsCount: 0, sourcesCount: 0, generationsCount: 0 },
				error: `Person not found: ${options.rootPersonCrId}`,
				warnings: [],
				rootPerson: { crId: '', name: 'Unknown', filePath: '' },
				ancestors: new Map()
			};
		}

		const rootPerson = this.nodeToReportPerson(rootNode);

		// Build ancestor tree using Sosa-Stradonitz numbering
		this.collectAncestors(1, rootNode, ancestors, familyGraph, options.maxGenerations, 1);

		// Calculate actual generations found
		let maxGenFound = 1;
		for (const num of ancestors.keys()) {
			const gen = Math.floor(Math.log2(num)) + 1;
			if (gen > maxGenFound) maxGenFound = gen;
		}

		// Generate markdown content
		const content = this.generateMarkdown(rootPerson, ancestors, options, maxGenFound);

		const suggestedFilename = `Ahnentafel - ${rootPerson.name}.md`;

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
			ancestors
		};
	}

	/**
	 * Recursively collect ancestors with Sosa-Stradonitz numbers
	 * @param sosaNumber - The Sosa number for this person
	 * @param node - The person node
	 * @param ancestors - Map to store ancestors
	 * @param familyGraph - Family graph service
	 * @param maxGenerations - Maximum generations to traverse
	 * @param currentGeneration - Current generation depth
	 */
	private collectAncestors(
		sosaNumber: number,
		node: PersonNode,
		ancestors: Map<number, ReportPerson>,
		familyGraph: FamilyGraphService,
		maxGenerations: number,
		currentGeneration: number
	): void {
		// Add this person
		ancestors.set(sosaNumber, this.nodeToReportPerson(node));

		// Stop if we've reached max generations
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
	 * Get generation label (1 = self, 2 = parents, 3 = grandparents, etc.)
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
	 * Generate markdown content for the Ahnentafel report
	 */
	private generateMarkdown(
		rootPerson: ReportPerson,
		ancestors: Map<number, ReportPerson>,
		options: AhnentafelOptions,
		maxGenFound: number
	): string {
		const lines: string[] = [];

		// Title
		lines.push(`# Ahnentafel Report: ${rootPerson.name}`);
		lines.push('');
		lines.push(`Ancestors traced through ${maxGenFound} generation${maxGenFound > 1 ? 's' : ''}.`);
		lines.push('');

		// Group ancestors by generation
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

			// Generation header
			lines.push(`## Generation ${gen} (${this.getGenerationLabel(gen)})`);
			lines.push('');

			// List ancestors in this generation
			for (const { num, person } of genAncestors) {
				lines.push(`${num}. **[[${person.name}]]**`);

				if (options.includeDetails) {
					if (person.birthDate || person.birthPlace) {
						const birthParts = [person.birthDate, person.birthPlace].filter(Boolean);
						lines.push(`   - Birth: ${birthParts.join(', ')}`);
					}
					if (person.deathDate || person.deathPlace) {
						const deathParts = [person.deathDate, person.deathPlace].filter(Boolean);
						lines.push(`   - Death: ${deathParts.join(', ')}`);
					}
				}
				lines.push('');
			}
		}

		// Summary statistics
		lines.push('## Summary');
		lines.push('');
		lines.push(`- **Total ancestors found:** ${ancestors.size}`);
		lines.push(`- **Generations traced:** ${maxGenFound}`);

		// Calculate completeness by generation
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
			lines.push(`  - Generation ${gen}: ${found}/${expected} (${percent}%)`);
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
