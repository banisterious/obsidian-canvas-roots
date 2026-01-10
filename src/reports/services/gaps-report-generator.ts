/**
 * Gaps Report Generator
 *
 * Generates a report of missing data and research opportunities.
 */

import { App } from 'obsidian';
import type { CanvasRootsSettings } from '../../settings';
import type {
	GapsReportOptions,
	GapsReportResult,
	ReportPerson
} from '../types/report-types';
import { FamilyGraphService, PersonNode } from '../../core/family-graph';
import { FolderFilterService } from '../../core/folder-filter';
import { getLogger } from '../../core/logging';

const logger = getLogger('GapsReportGenerator');

/**
 * Generator for Gaps Report
 */
export class GapsReportGenerator {
	private app: App;
	private settings: CanvasRootsSettings;

	constructor(app: App, settings: CanvasRootsSettings) {
		this.app = app;
		this.settings = settings;
	}

	/**
	 * Generate a Gaps Report
	 */
	async generate(options: GapsReportOptions): Promise<GapsReportResult> {
		await Promise.resolve(); // Satisfy async requirement
		logger.info('generate', 'Generating Gaps Report', { scope: options.scope });

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

		// Get all people
		let allPeople = familyGraph.getAllPeople();

		// Filter by collection if specified
		if (options.scope === 'collection' && options.collectionPath) {
			allPeople = allPeople.filter(p => p.file.path.startsWith(options.collectionPath!));
		}

		// Filter by research level if specified
		if (options.researchLevelMax !== undefined) {
			allPeople = allPeople.filter(p => {
				if (p.researchLevel === undefined) {
					// Include unassessed people only if option is set
					return options.includeUnassessed !== false;
				}
				return p.researchLevel <= options.researchLevelMax!;
			});
		}

		// Calculate research level statistics before further filtering
		const researchLevelStats = this.calculateResearchLevelStats(allPeople);

		// Analyze gaps
		const missingBirthDates: ReportPerson[] = [];
		const missingDeathDates: ReportPerson[] = [];
		const missingParents: ReportPerson[] = [];
		const unsourcedPeople: ReportPerson[] = [];

		for (const person of allPeople) {
			const reportPerson = this.nodeToReportPerson(person);

			// Check birth date
			if (options.fieldsToCheck.birthDate && !person.birthDate) {
				missingBirthDates.push(reportPerson);
			}

			// Check death date (only for people who are likely deceased)
			if (options.fieldsToCheck.deathDate && !person.deathDate) {
				// Skip if they have a recent birth date (likely living)
				const isLikelyLiving = this.isLikelyLiving(person);
				if (!isLikelyLiving) {
					missingDeathDates.push(reportPerson);
				}
			}

			// Check parents
			if (options.fieldsToCheck.parents && !person.fatherCrId && !person.motherCrId) {
				missingParents.push(reportPerson);
			}

			// Check sources
			if (options.fieldsToCheck.sources && (!person.sourceCount || person.sourceCount === 0)) {
				unsourcedPeople.push(reportPerson);
			}
		}

		// Sort by research level if requested (lowest first = most needs work)
		if (options.sortByResearchLevel) {
			const sortByLevel = (a: ReportPerson, b: ReportPerson) => {
				// Unassessed (undefined) sorts after all levels
				const aLevel = a.researchLevel ?? 999;
				const bLevel = b.researchLevel ?? 999;
				return aLevel - bLevel;
			};
			missingBirthDates.sort(sortByLevel);
			missingDeathDates.sort(sortByLevel);
			missingParents.sort(sortByLevel);
			unsourcedPeople.sort(sortByLevel);
		}

		// Apply limits
		const limitedMissingBirthDates = missingBirthDates.slice(0, options.maxItemsPerCategory);
		const limitedMissingDeathDates = missingDeathDates.slice(0, options.maxItemsPerCategory);
		const limitedMissingParents = missingParents.slice(0, options.maxItemsPerCategory);
		const limitedUnsourcedPeople = unsourcedPeople.slice(0, options.maxItemsPerCategory);

		// Summary statistics
		const summary = {
			totalPeople: allPeople.length,
			missingBirthDate: missingBirthDates.length,
			missingDeathDate: missingDeathDates.length,
			missingParents: missingParents.length,
			unsourced: unsourcedPeople.length,
			byResearchLevel: researchLevelStats
		};

		// Generate markdown content
		const content = this.generateMarkdown(
			summary,
			limitedMissingBirthDates,
			limitedMissingDeathDates,
			limitedMissingParents,
			limitedUnsourcedPeople,
			options
		);

		const date = new Date().toISOString().split('T')[0];
		const suggestedFilename = `Gaps Report - ${date}.md`;

		return {
			success: true,
			content,
			suggestedFilename,
			stats: {
				peopleCount: allPeople.length,
				eventsCount: 0,
				sourcesCount: 0
			},
			warnings,
			summary,
			missingBirthDates: limitedMissingBirthDates,
			missingDeathDates: limitedMissingDeathDates,
			missingParents: limitedMissingParents,
			unsourcedPeople: limitedUnsourcedPeople
		};
	}

	/**
	 * Calculate research level statistics
	 */
	private calculateResearchLevelStats(people: PersonNode[]): {
		levels: Record<number, number>;
		unassessed: number;
		needsWork: number;
		partial: number;
		complete: number;
	} {
		const levels: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
		let unassessed = 0;

		for (const person of people) {
			if (person.researchLevel === undefined) {
				unassessed++;
			} else if (person.researchLevel >= 0 && person.researchLevel <= 6) {
				levels[person.researchLevel]++;
			}
		}

		return {
			levels,
			unassessed,
			// Levels 0-2: needs significant work
			needsWork: levels[0] + levels[1] + levels[2],
			// Levels 3-4: partially researched
			partial: levels[3] + levels[4],
			// Levels 5-6: well researched / complete
			complete: levels[5] + levels[6]
		};
	}

	/**
	 * Check if a person is likely still living based on birth date
	 */
	private isLikelyLiving(person: PersonNode): boolean {
		if (!person.birthDate) return false;

		// Extract year from birth date
		const yearMatch = person.birthDate.match(/\d{4}/);
		if (!yearMatch) return false;

		const birthYear = parseInt(yearMatch[0], 10);
		const currentYear = new Date().getFullYear();

		// Assume anyone born in the last 100 years could be living
		return currentYear - birthYear < 100;
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
			filePath: node.file.path,
			researchLevel: node.researchLevel
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
	 * Calculate percentage
	 */
	private percent(count: number, total: number): number {
		if (total === 0) return 0;
		return Math.round((count / total) * 100);
	}

	/**
	 * Format research level for display
	 */
	private formatResearchLevel(level?: number): string {
		if (level === undefined) return '—';
		const names = ['Unidentified', 'Name Only', 'Vital Stats', 'Life Events', 'Extended', 'GPS Complete', 'Biography'];
		return `${level} - ${names[level] ?? 'Unknown'}`;
	}

	/**
	 * Generate markdown content for the Gaps Report
	 */
	private generateMarkdown(
		summary: {
			totalPeople: number;
			missingBirthDate: number;
			missingDeathDate: number;
			missingParents: number;
			unsourced: number;
			byResearchLevel: {
				levels: Record<number, number>;
				unassessed: number;
				needsWork: number;
				partial: number;
				complete: number;
			};
		},
		missingBirthDates: ReportPerson[],
		missingDeathDates: ReportPerson[],
		missingParents: ReportPerson[],
		unsourcedPeople: ReportPerson[],
		options: GapsReportOptions
	): string {
		const lines: string[] = [];
		const date = new Date().toLocaleDateString();

		// Title
		lines.push('# Research Gaps Report');
		lines.push('');
		lines.push(`Generated: ${date}`);
		if (options.scope === 'collection' && options.collectionPath) {
			lines.push(`Scope: ${options.collectionPath}`);
		}
		if (options.researchLevelMax !== undefined) {
			lines.push(`Research level filter: Level ${options.researchLevelMax} and below`);
		}
		lines.push('');

		// Summary
		lines.push('## Summary');
		lines.push('');
		lines.push(`- **Total people:** ${summary.totalPeople}`);
		lines.push(`- **Missing birth dates:** ${summary.missingBirthDate} (${this.percent(summary.missingBirthDate, summary.totalPeople)}%)`);
		lines.push(`- **Missing death dates:** ${summary.missingDeathDate} (${this.percent(summary.missingDeathDate, summary.totalPeople)}%)`);
		lines.push(`- **Missing parents:** ${summary.missingParents} (${this.percent(summary.missingParents, summary.totalPeople)}%)`);
		lines.push(`- **Unsourced people:** ${summary.unsourced} (${this.percent(summary.unsourced, summary.totalPeople)}%)`);
		lines.push('');

		// Research level summary
		lines.push('### Research level breakdown');
		lines.push('');
		const rl = summary.byResearchLevel;
		lines.push(`| Category | Count | % |`);
		lines.push(`|----------|------:|--:|`);
		lines.push(`| Needs work (0-2) | ${rl.needsWork} | ${this.percent(rl.needsWork, summary.totalPeople)}% |`);
		lines.push(`| Partially researched (3-4) | ${rl.partial} | ${this.percent(rl.partial, summary.totalPeople)}% |`);
		lines.push(`| Well researched (5-6) | ${rl.complete} | ${this.percent(rl.complete, summary.totalPeople)}% |`);
		lines.push(`| Not assessed | ${rl.unassessed} | ${this.percent(rl.unassessed, summary.totalPeople)}% |`);
		lines.push('');
		lines.push('**By level:**');
		lines.push('');
		for (let i = 0; i <= 6; i++) {
			const count = rl.levels[i];
			if (count > 0) {
				lines.push(`- Level ${i}: ${count} (${this.percent(count, summary.totalPeople)}%)`);
			}
		}
		lines.push('');

		// Missing Birth Dates
		if (options.fieldsToCheck.birthDate && missingBirthDates.length > 0) {
			lines.push(`## Missing birth dates (${summary.missingBirthDate})`);
			lines.push('');
			lines.push('| Person | Death | Research Level |');
			lines.push('|--------|-------|----------------|');

			for (const person of missingBirthDates) {
				const name = `[[${person.name}]]`;
				const death = person.deathDate ?? '';
				const level = this.formatResearchLevel(person.researchLevel);
				lines.push(`| ${name} | ${death} | ${level} |`);
			}

			if (summary.missingBirthDate > options.maxItemsPerCategory) {
				lines.push('');
				lines.push(`*...and ${summary.missingBirthDate - options.maxItemsPerCategory} more*`);
			}
			lines.push('');
		}

		// Missing Death Dates
		if (options.fieldsToCheck.deathDate && missingDeathDates.length > 0) {
			lines.push(`## Missing death dates (${summary.missingDeathDate})`);
			lines.push('');
			lines.push('| Person | Birth | Research Level |');
			lines.push('|--------|-------|----------------|');

			for (const person of missingDeathDates) {
				const name = `[[${person.name}]]`;
				const birth = person.birthDate ?? '';
				const level = this.formatResearchLevel(person.researchLevel);
				lines.push(`| ${name} | ${birth} | ${level} |`);
			}

			if (summary.missingDeathDate > options.maxItemsPerCategory) {
				lines.push('');
				lines.push(`*...and ${summary.missingDeathDate - options.maxItemsPerCategory} more*`);
			}
			lines.push('');
		}

		// Missing Parents
		if (options.fieldsToCheck.parents && missingParents.length > 0) {
			lines.push(`## Missing parents (${summary.missingParents})`);
			lines.push('');
			lines.push('| Person | Birth | Death | Research Level |');
			lines.push('|--------|-------|-------|----------------|');

			for (const person of missingParents) {
				const name = `[[${person.name}]]`;
				const birth = person.birthDate ?? '';
				const death = person.deathDate ?? '';
				const level = this.formatResearchLevel(person.researchLevel);
				lines.push(`| ${name} | ${birth} | ${death} | ${level} |`);
			}

			if (summary.missingParents > options.maxItemsPerCategory) {
				lines.push('');
				lines.push(`*...and ${summary.missingParents - options.maxItemsPerCategory} more*`);
			}
			lines.push('');
		}

		// Unsourced People
		if (options.fieldsToCheck.sources && unsourcedPeople.length > 0) {
			lines.push(`## Unsourced people (${summary.unsourced})`);
			lines.push('');
			lines.push('| Person | Birth | Death | Research Level |');
			lines.push('|--------|-------|-------|----------------|');

			for (const person of unsourcedPeople) {
				const name = `[[${person.name}]]`;
				const birth = person.birthDate ?? '';
				const death = person.deathDate ?? '';
				const level = this.formatResearchLevel(person.researchLevel);
				lines.push(`| ${name} | ${birth} | ${death} | ${level} |`);
			}

			if (summary.unsourced > options.maxItemsPerCategory) {
				lines.push('');
				lines.push(`*...and ${summary.unsourced - options.maxItemsPerCategory} more*`);
			}
			lines.push('');
		}

		// Research suggestions
		lines.push('## Research suggestions');
		lines.push('');
		lines.push('Based on this analysis, consider:');
		lines.push('');
		if (summary.missingBirthDate > 0) {
			lines.push('- [ ] Search vital records for missing birth dates');
		}
		if (summary.missingDeathDate > 0) {
			lines.push('- [ ] Check obituaries and cemetery records for death dates');
		}
		if (summary.missingParents > 0) {
			lines.push('- [ ] Review census records to identify parents');
		}
		if (summary.unsourced > 0) {
			lines.push('- [ ] Add source citations to undocumented individuals');
		}
		lines.push('');

		// Footer
		lines.push('---');
		lines.push('*Generated by Charted Roots*');

		return lines.join('\n');
	}
}
