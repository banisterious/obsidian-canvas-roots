/**
 * Collection Overview Generator
 *
 * Generates a summary report of a collection (user-defined or auto-detected
 * family component) with member lists, generation analysis, and distributions.
 */

import { App } from 'obsidian';
import type { CanvasRootsSettings } from '../../settings';
import type {
	CollectionOverviewOptions,
	CollectionOverviewResult,
	ReportPerson
} from '../types/report-types';
import { FamilyGraphService, PersonNode } from '../../core/family-graph';
import { FolderFilterService } from '../../core/folder-filter';
import { getLogger } from '../../core/logging';
import { extractWikilinkPath } from '../../utils/wikilink-resolver';

const logger = getLogger('CollectionOverviewGenerator');

/**
 * Generator for Collection Overview reports
 */
export class CollectionOverviewGenerator {
	private app: App;
	private settings: CanvasRootsSettings;

	constructor(app: App, settings: CanvasRootsSettings) {
		this.app = app;
		this.settings = settings;
	}

	/**
	 * Generate a Collection Overview report
	 */
	async generate(options: CollectionOverviewOptions): Promise<CollectionOverviewResult> {
		await Promise.resolve(); // Satisfy async requirement
		logger.info('generate', 'Generating Collection Overview', {
			collectionId: options.collectionId,
			collectionType: options.collectionType
		});

		const warnings: string[] = [];

		// Initialize services
		const familyGraph = new FamilyGraphService(this.app);
		if (this.settings.folderFilterMode !== 'disabled') {
			familyGraph.setFolderFilter(new FolderFilterService(this.settings));
		}
		familyGraph.setPropertyAliases(this.settings.propertyAliases);
		familyGraph.setValueAliases(this.settings.valueAliases);
		familyGraph.setSettings(this.settings);
		familyGraph.ensureCacheLoaded();

		// Get the collection members
		let members: PersonNode[];
		let collectionName: string;

		if (options.collectionType === 'user') {
			// User-defined collection
			const userCollections = familyGraph.getUserCollections();
			const collection = userCollections.find(c => c.name === options.collectionId);
			if (!collection) {
				return this.errorResult(`Collection not found: ${options.collectionId}`);
			}
			members = collection.people;
			collectionName = collection.name;
		} else {
			// Auto-detected family component
			const components = familyGraph.findAllFamilyComponents();
			const component = components.find(c =>
				c.representative.crId === options.collectionId ||
				c.collectionName === options.collectionId
			);
			if (!component) {
				return this.errorResult(`Family component not found: ${options.collectionId}`);
			}
			members = component.people;
			collectionName = component.collectionName || `Family of ${component.representative.name}`;
		}

		// Sort members
		members = this.sortMembers(members, options.sortMembersBy);

		// Limit member list if needed
		const displayMembers = options.maxMembers > 0
			? members.slice(0, options.maxMembers)
			: members;

		// Calculate generation depth
		const generationDepth = this.calculateGenerationDepth(members, familyGraph);

		// Calculate date range
		const dateRange = this.calculateDateRange(members);

		// Generate analysis data
		const generationAnalysis = options.showGenerationAnalysis
			? this.analyzeGenerations(members, familyGraph)
			: undefined;

		const geographicDistribution = options.showGeographicDistribution
			? this.analyzeGeographicDistribution(members)
			: undefined;

		const surnameDistribution = options.showSurnameDistribution
			? this.analyzeSurnameDistribution(members)
			: undefined;

		const summary = {
			memberCount: members.length,
			generationDepth,
			dateRange
		};

		// Convert to report persons
		const reportMembers = displayMembers.map(p => this.nodeToReportPerson(p));

		// Generate markdown content
		const content = this.generateMarkdown(
			collectionName,
			options.collectionType,
			summary,
			reportMembers,
			generationAnalysis,
			geographicDistribution,
			surnameDistribution,
			options
		);

		const suggestedFilename = `Collection Overview - ${collectionName}.md`;

		return {
			success: true,
			content,
			suggestedFilename: this.sanitizeFilename(suggestedFilename),
			stats: {
				peopleCount: members.length,
				eventsCount: 0,
				sourcesCount: 0
			},
			warnings,
			collection: {
				id: options.collectionId,
				name: collectionName,
				type: options.collectionType
			},
			summary,
			members: reportMembers,
			generationAnalysis,
			geographicDistribution,
			surnameDistribution
		};
	}

	/**
	 * Sort members by the specified field
	 */
	private sortMembers(
		members: PersonNode[],
		sortBy: 'birth_date' | 'name' | 'death_date'
	): PersonNode[] {
		return [...members].sort((a, b) => {
			switch (sortBy) {
				case 'birth_date': {
					const aDate = this.extractSortDate(a.birthDate || '');
					const bDate = this.extractSortDate(b.birthDate || '');
					if (!aDate && !bDate) return a.name.localeCompare(b.name);
					if (!aDate) return 1;
					if (!bDate) return -1;
					return aDate.localeCompare(bDate);
				}
				case 'death_date': {
					const aDate = this.extractSortDate(a.deathDate || '');
					const bDate = this.extractSortDate(b.deathDate || '');
					if (!aDate && !bDate) return a.name.localeCompare(b.name);
					if (!aDate) return 1;
					if (!bDate) return -1;
					return aDate.localeCompare(bDate);
				}
				case 'name':
				default:
					return a.name.localeCompare(b.name);
			}
		});
	}

	/**
	 * Calculate the maximum generation depth in the collection
	 */
	private calculateGenerationDepth(members: PersonNode[], familyGraph: FamilyGraphService): number {
		const memberIds = new Set(members.map(m => m.crId));
		let maxDepth = 0;

		// Find root ancestors (no parents in the collection)
		const roots = members.filter(m => {
			const hasParentInCollection =
				(m.fatherCrId && memberIds.has(m.fatherCrId)) ||
				(m.motherCrId && memberIds.has(m.motherCrId));
			return !hasParentInCollection;
		});

		// BFS from each root to find max depth
		for (const root of roots) {
			const depth = this.measureDescendantDepth(root.crId, memberIds, familyGraph, new Set());
			if (depth > maxDepth) {
				maxDepth = depth;
			}
		}

		return maxDepth;
	}

	/**
	 * Measure descendant depth from a person
	 */
	private measureDescendantDepth(
		crId: string,
		memberIds: Set<string>,
		familyGraph: FamilyGraphService,
		visited: Set<string>
	): number {
		if (visited.has(crId)) return 0;
		visited.add(crId);

		const person = familyGraph.getPersonByCrId(crId);
		if (!person) return 1;

		let maxChildDepth = 0;
		for (const childId of person.childrenCrIds) {
			if (memberIds.has(childId)) {
				const childDepth = this.measureDescendantDepth(childId, memberIds, familyGraph, visited);
				if (childDepth > maxChildDepth) {
					maxChildDepth = childDepth;
				}
			}
		}

		return 1 + maxChildDepth;
	}

	/**
	 * Calculate the date range of members
	 */
	private calculateDateRange(members: PersonNode[]): { earliest?: string; latest?: string } {
		const dates: string[] = [];

		for (const person of members) {
			if (person.birthDate) dates.push(person.birthDate);
			if (person.deathDate) dates.push(person.deathDate);
		}

		const sortedDates = dates
			.map(d => this.extractSortDate(d))
			.filter(Boolean)
			.sort();

		return {
			earliest: sortedDates[0],
			latest: sortedDates[sortedDates.length - 1]
		};
	}

	/**
	 * Analyze generation distribution
	 */
	private analyzeGenerations(
		members: PersonNode[],
		familyGraph: FamilyGraphService
	): Record<number, number> {
		const memberIds = new Set(members.map(m => m.crId));
		const generations: Record<number, number> = {};

		// Find root ancestors
		const roots = members.filter(m => {
			const hasParentInCollection =
				(m.fatherCrId && memberIds.has(m.fatherCrId)) ||
				(m.motherCrId && memberIds.has(m.motherCrId));
			return !hasParentInCollection;
		});

		// BFS to assign generations
		const personGenerations = new Map<string, number>();
		const queue: Array<{ crId: string; gen: number }> = roots.map(r => ({ crId: r.crId, gen: 1 }));

		while (queue.length > 0) {
			const { crId, gen } = queue.shift()!;
			if (personGenerations.has(crId)) continue;

			personGenerations.set(crId, gen);
			generations[gen] = (generations[gen] || 0) + 1;

			const person = familyGraph.getPersonByCrId(crId);
			if (person) {
				for (const childId of person.childrenCrIds) {
					if (memberIds.has(childId) && !personGenerations.has(childId)) {
						queue.push({ crId: childId, gen: gen + 1 });
					}
				}
			}
		}

		return generations;
	}

	/**
	 * Analyze geographic distribution
	 */
	private analyzeGeographicDistribution(
		members: PersonNode[]
	): Array<{ place: string; count: number }> {
		const placeCounts = new Map<string, number>();

		for (const person of members) {
			if (person.birthPlace) {
				const place = this.extractLinkName(person.birthPlace);
				placeCounts.set(place, (placeCounts.get(place) || 0) + 1);
			}
			if (person.deathPlace) {
				const place = this.extractLinkName(person.deathPlace);
				placeCounts.set(place, (placeCounts.get(place) || 0) + 1);
			}
		}

		return Array.from(placeCounts.entries())
			.map(([place, count]) => ({ place, count }))
			.sort((a, b) => b.count - a.count)
			.slice(0, 20);
	}

	/**
	 * Analyze surname distribution
	 */
	private analyzeSurnameDistribution(
		members: PersonNode[]
	): Array<{ surname: string; count: number }> {
		const surnameCounts = new Map<string, number>();

		for (const person of members) {
			const surname = this.extractSurname(person.name);
			if (surname) {
				surnameCounts.set(surname, (surnameCounts.get(surname) || 0) + 1);
			}
		}

		return Array.from(surnameCounts.entries())
			.map(([surname, count]) => ({ surname, count }))
			.sort((a, b) => b.count - a.count)
			.slice(0, 20);
	}

	/**
	 * Extract surname from a full name
	 */
	private extractSurname(name: string): string {
		const parts = name.split(' ');
		if (parts.length > 1) {
			return parts[parts.length - 1];
		}
		return name;
	}

	/**
	 * Extract the name from a wikilink
	 */
	private extractLinkName(link: string): string {
		return extractWikilinkPath(link);
	}

	/**
	 * Extract a sortable date from various date formats
	 */
	private extractSortDate(date: string): string {
		if (!date) return '';
		if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
		if (/^\d{4}-\d{2}$/.test(date)) return date + '-01';
		if (/^\d{4}$/.test(date)) return date + '-01-01';
		const yearMatch = date.match(/\d{4}/);
		if (yearMatch) return yearMatch[0] + '-01-01';
		return '';
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
	 * Normalize sex value
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
	 * Generate markdown content
	 */
	private generateMarkdown(
		collectionName: string,
		collectionType: 'user' | 'component',
		summary: { memberCount: number; generationDepth: number; dateRange: { earliest?: string; latest?: string } },
		members: ReportPerson[],
		generationAnalysis: Record<number, number> | undefined,
		geographicDistribution: Array<{ place: string; count: number }> | undefined,
		surnameDistribution: Array<{ surname: string; count: number }> | undefined,
		options: CollectionOverviewOptions
	): string {
		const lines: string[] = [];
		const date = new Date().toLocaleDateString();

		// Title
		lines.push(`# Collection Overview: ${collectionName}`);
		lines.push('');
		lines.push(`Generated: ${date}`);
		lines.push('');

		const typeLabel = collectionType === 'user' ? 'User-defined collection' : 'Auto-detected family group';
		lines.push(`*${typeLabel}*`);
		lines.push('');

		// Summary
		lines.push('## Summary');
		lines.push('');
		lines.push(`- **Members:** ${summary.memberCount}`);
		lines.push(`- **Generations:** ${summary.generationDepth}`);
		if (summary.dateRange.earliest || summary.dateRange.latest) {
			const range = [summary.dateRange.earliest, summary.dateRange.latest].filter(Boolean).join(' to ');
			lines.push(`- **Date range:** ${range}`);
		}
		lines.push('');

		// Generation analysis
		if (options.showGenerationAnalysis && generationAnalysis) {
			lines.push('## Generation analysis');
			lines.push('');
			lines.push('| Generation | Count |');
			lines.push('|------------|-------|');
			const gens = Object.keys(generationAnalysis).map(Number).sort((a, b) => a - b);
			for (const gen of gens) {
				lines.push(`| ${gen} | ${generationAnalysis[gen]} |`);
			}
			lines.push('');
		}

		// Surname distribution
		if (options.showSurnameDistribution && surnameDistribution && surnameDistribution.length > 0) {
			lines.push('## Surname distribution');
			lines.push('');
			lines.push('| Surname | Count |');
			lines.push('|---------|-------|');
			for (const { surname, count } of surnameDistribution) {
				lines.push(`| ${surname} | ${count} |`);
			}
			lines.push('');
		}

		// Geographic distribution
		if (options.showGeographicDistribution && geographicDistribution && geographicDistribution.length > 0) {
			lines.push('## Geographic distribution');
			lines.push('');
			lines.push('| Place | Count |');
			lines.push('|-------|-------|');
			for (const { place, count } of geographicDistribution) {
				lines.push(`| [[${place}]] | ${count} |`);
			}
			lines.push('');
		}

		// Member list
		if (options.includeMemberList && members.length > 0) {
			lines.push(`## Members (${members.length})`);
			lines.push('');
			lines.push('| Name | Birth | Death |');
			lines.push('|------|-------|-------|');
			for (const person of members) {
				const birth = person.birthDate || '';
				const death = person.deathDate || '';
				lines.push(`| [[${person.name}]] | ${birth} | ${death} |`);
			}
			lines.push('');
		}

		// Footer
		lines.push('---');
		lines.push('*Generated by Charted Roots*');

		return lines.join('\n');
	}

	/**
	 * Create an error result
	 */
	private errorResult(error: string): CollectionOverviewResult {
		return {
			success: false,
			content: '',
			suggestedFilename: 'collection-overview.md',
			stats: { peopleCount: 0, eventsCount: 0, sourcesCount: 0 },
			error,
			warnings: [],
			collection: { id: '', name: 'Unknown', type: 'user' },
			summary: { memberCount: 0, generationDepth: 0, dateRange: {} },
			members: []
		};
	}

	/**
	 * Sanitize a filename
	 */
	private sanitizeFilename(filename: string): string {
		return filename.replace(/[<>:"/\\|?*]/g, '-');
	}
}
