/**
 * Register Report Generator
 *
 * Generates a Register Report using NGSQ (National Genealogical Society Quarterly)
 * style descendant numbering. The numbering system works as follows:
 * - The progenitor is number 1
 * - Children who continue the line get sequential Arabic numerals (2, 3, 4...)
 * - Children who don't continue are shown with Roman numerals (i, ii, iii...)
 * - Each numbered descendant gets their own section
 */

import { App } from 'obsidian';
import type { CanvasRootsSettings } from '../../settings';
import type {
	RegisterReportOptions,
	RegisterReportResult,
	RegisterEntry,
	ReportPerson
} from '../types/report-types';
import { FamilyGraphService, PersonNode } from '../../core/family-graph';
import { FolderFilterService } from '../../core/folder-filter';
import { getLogger } from '../../core/logging';

const logger = getLogger('RegisterReportGenerator');

/**
 * Internal tracking for register numbering
 */
interface NumberingContext {
	nextNumber: number;
	entries: RegisterEntry[];
	maxGenerations: number;
}

/**
 * Generator for Register Reports (NGSQ-style)
 */
export class RegisterReportGenerator {
	private app: App;
	private settings: CanvasRootsSettings;

	constructor(app: App, settings: CanvasRootsSettings) {
		this.app = app;
		this.settings = settings;
	}

	/**
	 * Generate a Register Report
	 */
	async generate(options: RegisterReportOptions): Promise<RegisterReportResult> {
		await Promise.resolve(); // Satisfy async requirement
		logger.info('generate', 'Generating Register Report', {
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
				suggestedFilename: 'register-report.md',
				stats: { peopleCount: 0, eventsCount: 0, sourcesCount: 0, generationsCount: 0 },
				error: `Person not found: ${options.rootPersonCrId}`,
				warnings: [],
				rootPerson: { crId: '', name: 'Unknown', filePath: '' },
				entries: []
			};
		}

		const rootPerson = this.nodeToReportPerson(rootNode);

		// Build register entries using NGSQ numbering
		const context: NumberingContext = {
			nextNumber: 1,
			entries: [],
			maxGenerations: options.maxGenerations
		};

		this.buildRegister(rootNode, familyGraph, context, 1, options);

		// Calculate generations found
		let maxGenFound = 0;
		for (const entry of context.entries) {
			if (entry.generation > maxGenFound) {
				maxGenFound = entry.generation;
			}
		}

		// Generate markdown content
		const content = this.generateMarkdown(rootPerson, context.entries, options, maxGenFound);

		const suggestedFilename = `Register Report - ${rootPerson.name}.md`;

		return {
			success: true,
			content,
			suggestedFilename: this.sanitizeFilename(suggestedFilename),
			stats: {
				peopleCount: context.entries.length,
				eventsCount: 0,
				sourcesCount: 0,
				generationsCount: maxGenFound
			},
			warnings,
			rootPerson,
			entries: context.entries
		};
	}

	/**
	 * Recursively build register entries
	 */
	private buildRegister(
		node: PersonNode,
		familyGraph: FamilyGraphService,
		context: NumberingContext,
		generation: number,
		options: RegisterReportOptions
	): string | undefined {
		// Check generation limit
		if (generation > context.maxGenerations) {
			return undefined;
		}

		// Assign register number to this person
		const registerNumber = String(context.nextNumber);
		context.nextNumber++;

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

		// Get children and determine which continue the line
		const children: Array<{ person: ReportPerson; registerNumber?: string; node: PersonNode }> = [];
		for (const childCrId of node.childrenCrIds) {
			const childNode = familyGraph.getPersonByCrId(childCrId);
			if (childNode) {
				children.push({
					person: this.nodeToReportPerson(childNode),
					node: childNode
				});
			}
		}

		// Sort children by birth date if available
		children.sort((a, b) => {
			if (!a.person.birthDate && !b.person.birthDate) return 0;
			if (!a.person.birthDate) return 1;
			if (!b.person.birthDate) return -1;
			return a.person.birthDate.localeCompare(b.person.birthDate);
		});

		// Determine which children continue the line (have descendants)
		// and assign them register numbers
		const childrenWithNumbers: Array<{ person: ReportPerson; registerNumber?: string }> = [];
		const childrenToContinue: Array<{ node: PersonNode; index: number }> = [];

		for (let i = 0; i < children.length; i++) {
			const child = children[i];
			const hasDescendants = child.node.childrenCrIds.length > 0;
			const withinGenLimit = generation < context.maxGenerations;

			if (hasDescendants && withinGenLimit) {
				// This child will get a register number and continue the line
				childrenToContinue.push({ node: child.node, index: i });
				childrenWithNumbers.push({
					person: child.person,
					registerNumber: '' // Will be filled in when we process them
				});
			} else {
				// This child doesn't continue - use Roman numeral
				childrenWithNumbers.push({
					person: child.person,
					registerNumber: undefined
				});
			}
		}

		// Create entry for this person
		const entry: RegisterEntry = {
			registerNumber,
			person: this.nodeToReportPerson(node),
			generation,
			hasDescendants: childrenToContinue.length > 0,
			spouses,
			children: childrenWithNumbers
		};

		context.entries.push(entry);

		// Now recursively process children who continue the line
		// This is done after adding the current entry so numbers are in order
		for (const { node: childNode, index } of childrenToContinue) {
			const childRegNum = this.buildRegister(childNode, familyGraph, context, generation + 1, options);
			if (childRegNum) {
				childrenWithNumbers[index].registerNumber = childRegNum;
			}
		}

		return registerNumber;
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
	 * Convert number to Roman numeral (for children who don't continue the line)
	 */
	private toRoman(num: number): string {
		const romanNumerals: Array<[number, string]> = [
			[10, 'x'],
			[9, 'ix'],
			[5, 'v'],
			[4, 'iv'],
			[1, 'i']
		];

		let result = '';
		let remaining = num;

		for (const [value, numeral] of romanNumerals) {
			while (remaining >= value) {
				result += numeral;
				remaining -= value;
			}
		}

		return result;
	}

	/**
	 * Generate markdown content for the Register Report
	 */
	private generateMarkdown(
		rootPerson: ReportPerson,
		entries: RegisterEntry[],
		options: RegisterReportOptions,
		maxGenFound: number
	): string {
		const lines: string[] = [];

		// Title
		lines.push(`# Register Report: Descendants of ${rootPerson.name}`);
		lines.push('');
		lines.push('This report uses NGSQ (National Genealogical Society Quarterly) style numbering.');
		lines.push(`Descendants traced through ${maxGenFound} generation${maxGenFound > 1 ? 's' : ''}.`);
		lines.push('');

		// Process each entry
		for (const entry of entries) {
			// Section header for this person
			lines.push(`## ${entry.registerNumber}. [[${entry.person.name}]]`);
			lines.push('');

			// Vital information
			if (options.includeDetails) {
				if (entry.person.birthDate || entry.person.birthPlace) {
					const birthParts = [entry.person.birthDate, entry.person.birthPlace].filter(Boolean);
					lines.push(`**Born:** ${birthParts.join(', ')}`);
				}
				if (entry.person.deathDate || entry.person.deathPlace) {
					const deathParts = [entry.person.deathDate, entry.person.deathPlace].filter(Boolean);
					lines.push(`**Died:** ${deathParts.join(', ')}`);
				}
				if (entry.person.occupation) {
					lines.push(`**Occupation:** ${entry.person.occupation}`);
				}
				lines.push('');
			}

			// Spouse information
			if (options.includeSpouses && entry.spouses.length > 0) {
				for (const spouse of entry.spouses) {
					lines.push(`**Married:** [[${spouse.name}]]`);
					if (options.includeDetails) {
						if (spouse.birthDate || spouse.birthPlace) {
							const birthParts = [spouse.birthDate, spouse.birthPlace].filter(Boolean);
							lines.push(`- Born: ${birthParts.join(', ')}`);
						}
						if (spouse.deathDate || spouse.deathPlace) {
							const deathParts = [spouse.deathDate, spouse.deathPlace].filter(Boolean);
							lines.push(`- Died: ${deathParts.join(', ')}`);
						}
					}
				}
				lines.push('');
			}

			// Children
			if (entry.children.length > 0) {
				lines.push('**Children:**');
				lines.push('');

				let romanCounter = 1;
				for (const child of entry.children) {
					if (child.registerNumber) {
						// Child continues the line - use their register number with superscript reference
						lines.push(`${child.registerNumber}. [[${child.person.name}]]`);
					} else {
						// Child doesn't continue - use Roman numeral
						lines.push(`  ${this.toRoman(romanCounter)}. [[${child.person.name}]]`);
						romanCounter++;
					}

					if (options.includeDetails) {
						const details: string[] = [];
						if (child.person.birthDate) {
							details.push(`b. ${child.person.birthDate}`);
						}
						if (child.person.deathDate) {
							details.push(`d. ${child.person.deathDate}`);
						}
						if (details.length > 0) {
							lines.push(`     (${details.join('; ')})`);
						}
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
		lines.push(`- **Total people:** ${entries.length}`);
		lines.push(`- **Generations:** ${maxGenFound}`);

		// Count by generation
		const byGeneration = new Map<number, number>();
		for (const entry of entries) {
			byGeneration.set(entry.generation, (byGeneration.get(entry.generation) || 0) + 1);
		}
		lines.push('- **By generation:**');
		for (let gen = 1; gen <= maxGenFound; gen++) {
			const count = byGeneration.get(gen) || 0;
			lines.push(`  - Generation ${gen}: ${count}`);
		}
		lines.push('');

		// Footer
		lines.push('---');
		lines.push('*Generated by Charted Roots*');

		return lines.join('\n');
	}

	/**
	 * Sanitize a filename by removing invalid characters
	 */
	private sanitizeFilename(filename: string): string {
		return filename.replace(/[<>:"/\\|?*]/g, '-');
	}
}
