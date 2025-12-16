/**
 * Family Group Sheet Generator
 *
 * Generates a family group sheet report for a couple and their children.
 */

import { App } from 'obsidian';
import type { CanvasRootsSettings } from '../../settings';
import type {
	FamilyGroupSheetOptions,
	FamilyGroupSheetResult,
	ReportPerson,
	ReportEvent
} from '../types/report-types';
import { FamilyGraphService, PersonNode } from '../../core/family-graph';
import { FolderFilterService } from '../../core/folder-filter';
import { getLogger } from '../../core/logging';

const logger = getLogger('FamilyGroupSheetGenerator');

/**
 * Generator for Family Group Sheet reports
 */
export class FamilyGroupSheetGenerator {
	private app: App;
	private settings: CanvasRootsSettings;

	constructor(app: App, settings: CanvasRootsSettings) {
		this.app = app;
		this.settings = settings;
	}

	/**
	 * Generate a Family Group Sheet report
	 */
	async generate(options: FamilyGroupSheetOptions): Promise<FamilyGroupSheetResult> {
		logger.info('generate', 'Generating Family Group Sheet', { personCrId: options.personCrId });

		const warnings: string[] = [];
		const sourcesSet = new Set<string>();

		// Initialize family graph service
		const familyGraph = new FamilyGraphService(this.app);
		if (this.settings.folderFilterMode !== 'disabled') {
			familyGraph.setFolderFilter(new FolderFilterService(this.settings));
		}
		familyGraph.setPropertyAliases(this.settings.propertyAliases);
		familyGraph.setValueAliases(this.settings.valueAliases);
		familyGraph.setSettings(this.settings);
		familyGraph.ensureCacheLoaded();

		// Get the primary person
		const primaryNode = familyGraph.getPersonByCrId(options.personCrId);
		if (!primaryNode) {
			return {
				success: false,
				content: '',
				suggestedFilename: 'family-group-sheet.md',
				stats: { peopleCount: 0, eventsCount: 0, sourcesCount: 0 },
				error: `Person not found: ${options.personCrId}`,
				warnings: [],
				primaryPerson: { crId: '', name: 'Unknown', filePath: '' },
				spouses: [],
				children: []
			};
		}

		const primaryPerson = this.nodeToReportPerson(primaryNode);

		// Get spouses
		const spouses: ReportPerson[] = [];
		for (const spouseCrId of primaryNode.spouseCrIds) {
			const spouseNode = familyGraph.getPersonByCrId(spouseCrId);
			if (spouseNode) {
				spouses.push(this.nodeToReportPerson(spouseNode));
			} else {
				warnings.push(`Spouse not found: ${spouseCrId}`);
			}
		}

		// Get children
		const children: ReportPerson[] = [];
		if (options.includeChildren) {
			for (const childCrId of primaryNode.childrenCrIds) {
				const childNode = familyGraph.getPersonByCrId(childCrId);
				if (childNode) {
					const childPerson = this.nodeToReportPerson(childNode);
					// Add spouse info for child if available
					if (childNode.spouseCrIds.length > 0) {
						const firstSpouse = familyGraph.getPersonByCrId(childNode.spouseCrIds[0]);
						if (firstSpouse) {
							(childPerson as ReportPerson & { spouseName?: string }).spouseName = firstSpouse.name;
						}
					}
					children.push(childPerson);
				}
			}
		}

		// Get parents for both primary person and spouse(s)
		const primaryParents = this.getParents(primaryNode, familyGraph);
		const spouseParents: Array<{ father?: ReportPerson; mother?: ReportPerson }> = [];
		for (const spouse of spouses) {
			const spouseNode = familyGraph.getPersonByCrId(spouse.crId);
			if (spouseNode) {
				spouseParents.push(this.getParents(spouseNode, familyGraph));
			}
		}

		// Generate markdown content
		const content = this.generateMarkdown(
			primaryPerson,
			primaryParents,
			spouses,
			spouseParents,
			children,
			options,
			sourcesSet
		);

		// Determine filename
		const suggestedFilename = spouses.length > 0
			? `Family Group - ${primaryPerson.name} & ${spouses[0].name}.md`
			: `Family Group - ${primaryPerson.name}.md`;

		return {
			success: true,
			content,
			suggestedFilename: this.sanitizeFilename(suggestedFilename),
			stats: {
				peopleCount: 1 + spouses.length + children.length,
				eventsCount: 0,
				sourcesCount: sourcesSet.size
			},
			warnings,
			primaryPerson,
			spouses,
			children
		};
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
	 * Get parents for a person
	 */
	private getParents(
		node: PersonNode,
		familyGraph: FamilyGraphService
	): { father?: ReportPerson; mother?: ReportPerson } {
		const result: { father?: ReportPerson; mother?: ReportPerson } = {};

		if (node.fatherCrId) {
			const father = familyGraph.getPersonByCrId(node.fatherCrId);
			if (father) {
				result.father = this.nodeToReportPerson(father);
			}
		}

		if (node.motherCrId) {
			const mother = familyGraph.getPersonByCrId(node.motherCrId);
			if (mother) {
				result.mother = this.nodeToReportPerson(mother);
			}
		}

		return result;
	}

	/**
	 * Generate markdown content for the Family Group Sheet
	 */
	private generateMarkdown(
		primaryPerson: ReportPerson,
		primaryParents: { father?: ReportPerson; mother?: ReportPerson },
		spouses: ReportPerson[],
		spouseParents: Array<{ father?: ReportPerson; mother?: ReportPerson }>,
		children: ReportPerson[],
		options: FamilyGroupSheetOptions,
		sourcesSet: Set<string>
	): string {
		const lines: string[] = [];

		// Title
		const title = spouses.length > 0
			? `# Family Group Sheet: ${primaryPerson.name} & ${spouses[0].name}`
			: `# Family Group Sheet: ${primaryPerson.name}`;
		lines.push(title);
		lines.push('');

		// Determine who is husband/wife based on sex, or use primary/spouse
		const primaryIsHusband = primaryPerson.sex === 'male' || spouses[0]?.sex === 'female';

		// Husband section
		const husband = primaryIsHusband ? primaryPerson : spouses[0];
		const husbandParents = primaryIsHusband ? primaryParents : spouseParents[0] ?? {};
		if (husband) {
			lines.push('## Husband');
			lines.push(...this.formatPersonSection(husband, husbandParents, options.includeSources, sourcesSet));
			lines.push('');
		}

		// Wife section
		const wife = primaryIsHusband ? spouses[0] : primaryPerson;
		const wifeParents = primaryIsHusband ? spouseParents[0] ?? {} : primaryParents;
		if (wife) {
			lines.push('## Wife');
			lines.push(...this.formatPersonSection(wife, wifeParents, options.includeSources, sourcesSet));
			lines.push('');
		}

		// Marriage section (if we have spouse relationship data)
		if (options.includeEvents && spouses.length > 0) {
			lines.push('## Marriage');
			lines.push('- **Date:** (marriage date not yet extracted)');
			lines.push('- **Place:** (marriage place not yet extracted)');
			lines.push('');
		}

		// Children section
		if (options.includeChildren && children.length > 0) {
			lines.push('## Children');
			lines.push('| Name | Birth | Death | Spouse |');
			lines.push('|------|-------|-------|--------|');

			for (const child of children) {
				const childWithSpouse = child as ReportPerson & { spouseName?: string };
				const nameLink = `[[${child.name}]]`;
				const birth = child.birthDate ?? '';
				const death = child.deathDate ?? '';
				const spouse = childWithSpouse.spouseName ? `[[${childWithSpouse.spouseName}]]` : '';
				lines.push(`| ${nameLink} | ${birth} | ${death} | ${spouse} |`);
			}
			lines.push('');
		} else if (options.includeChildren) {
			lines.push('## Children');
			lines.push('No children recorded.');
			lines.push('');
		}

		// Sources section
		if (options.includeSources && sourcesSet.size > 0) {
			lines.push('## Sources');
			for (const source of Array.from(sourcesSet).sort()) {
				lines.push(`- [[${source}]]`);
			}
			lines.push('');
		}

		// Footer
		lines.push('---');
		lines.push('*Generated by Canvas Roots*');

		return lines.join('\n');
	}

	/**
	 * Format a person section with their details
	 */
	private formatPersonSection(
		person: ReportPerson,
		parents: { father?: ReportPerson; mother?: ReportPerson },
		includeSources: boolean,
		sourcesSet: Set<string>
	): string[] {
		const lines: string[] = [];

		lines.push(`- **Name:** [[${person.name}]]`);

		if (person.birthDate || person.birthPlace) {
			const birthParts = [person.birthDate, person.birthPlace].filter(Boolean);
			lines.push(`- **Birth:** ${birthParts.join(', ')}`);
		}

		if (person.deathDate || person.deathPlace) {
			const deathParts = [person.deathDate, person.deathPlace].filter(Boolean);
			lines.push(`- **Death:** ${deathParts.join(', ')}`);
		}

		if (person.occupation) {
			lines.push(`- **Occupation:** ${person.occupation}`);
		}

		// Parents
		if (parents.father || parents.mother) {
			const parentNames: string[] = [];
			if (parents.father) parentNames.push(`[[${parents.father.name}]]`);
			if (parents.mother) parentNames.push(`[[${parents.mother.name}]]`);
			lines.push(`- **Parents:** ${parentNames.join(' & ')}`);
		}

		return lines;
	}

	/**
	 * Sanitize a filename by removing invalid characters
	 */
	private sanitizeFilename(filename: string): string {
		return filename.replace(/[<>:"/\\|?*]/g, '-');
	}
}
