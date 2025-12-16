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
			unsourced: unsourcedPeople.length
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
	 * Calculate percentage
	 */
	private percent(count: number, total: number): number {
		if (total === 0) return 0;
		return Math.round((count / total) * 100);
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

		// Missing Birth Dates
		if (options.fieldsToCheck.birthDate && missingBirthDates.length > 0) {
			lines.push(`## Missing birth dates (${summary.missingBirthDate})`);
			lines.push('');
			lines.push('| Person | Death | Parents |');
			lines.push('|--------|-------|---------|');

			for (const person of missingBirthDates) {
				const name = `[[${person.name}]]`;
				const death = person.deathDate ?? '';
				const parents = ''; // Would need to look up parents
				lines.push(`| ${name} | ${death} | ${parents} |`);
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
			lines.push('| Person | Birth | Notes |');
			lines.push('|--------|-------|-------|');

			for (const person of missingDeathDates) {
				const name = `[[${person.name}]]`;
				const birth = person.birthDate ?? '';
				const notes = '';
				lines.push(`| ${name} | ${birth} | ${notes} |`);
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
			lines.push('| Person | Birth | Death |');
			lines.push('|--------|-------|-------|');

			for (const person of missingParents) {
				const name = `[[${person.name}]]`;
				const birth = person.birthDate ?? '';
				const death = person.deathDate ?? '';
				lines.push(`| ${name} | ${birth} | ${death} |`);
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
			lines.push('| Person | Birth | Death |');
			lines.push('|--------|-------|-------|');

			for (const person of unsourcedPeople) {
				const name = `[[${person.name}]]`;
				const birth = person.birthDate ?? '';
				const death = person.deathDate ?? '';
				lines.push(`| ${name} | ${birth} | ${death} |`);
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
		lines.push('*Generated by Canvas Roots*');

		return lines.join('\n');
	}
}
