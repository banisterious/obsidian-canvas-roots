/**
 * Source Summary Generator
 *
 * Generates a report of all sources cited for a person, grouped by fact type
 * with quality ratings and gap analysis.
 */

import { App } from 'obsidian';
import type { CanvasRootsSettings } from '../../settings';
import type {
	SourceSummaryOptions,
	SourceSummaryResult,
	SourceEntry,
	ReportPerson
} from '../types/report-types';
import { FamilyGraphService, PersonNode } from '../../core/family-graph';
import { FolderFilterService } from '../../core/folder-filter';
import { SourceService } from '../../sources/services/source-service';
import { EvidenceService } from '../../sources/services/evidence-service';
import {
	SourceNote,
	FACT_KEY_LABELS,
	getSourceQuality
} from '../../sources/types/source-types';

import { getLogger } from '../../core/logging';

/**
 * Quality type used in report entries (broader than SourceQuality)
 */
type ReportQuality = 'primary' | 'secondary' | 'derivative' | 'undetermined';

const logger = getLogger('SourceSummaryGenerator');

/**
 * Generator for Source Summary reports
 */
export class SourceSummaryGenerator {
	private app: App;
	private settings: CanvasRootsSettings;

	constructor(app: App, settings: CanvasRootsSettings) {
		this.app = app;
		this.settings = settings;
	}

	/**
	 * Generate a Source Summary report
	 */
	async generate(options: SourceSummaryOptions): Promise<SourceSummaryResult> {
		await Promise.resolve(); // Satisfy async requirement
		logger.info('generate', 'Generating Source Summary', { personCrId: options.personCrId });

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

		const sourceService = new SourceService(this.app, this.settings);
		const evidenceService = new EvidenceService(this.app, this.settings);

		// Get the person
		const personNode = familyGraph.getPersonByCrId(options.personCrId);
		if (!personNode) {
			return this.errorResult(`Person not found: ${options.personCrId}`);
		}

		const person = this.nodeToReportPerson(personNode);

		// Get fact coverage for this person
		const coverage = evidenceService.getFactCoverage(options.personCrId);

		// Collect all sources linked to this person
		const sourcesByFactType: Record<string, SourceEntry[]> = {};
		const unsourcedFacts: string[] = [];
		const allSourceCrIds = new Set<string>();
		const repositoryMap = new Map<string, number>();

		// Summary counters
		let primaryCount = 0;
		let secondaryCount = 0;
		let derivativeCount = 0;

		if (coverage) {
			for (const fact of coverage.facts) {
				const factLabel = FACT_KEY_LABELS[fact.factKey];

				if (fact.status === 'unsourced') {
					unsourcedFacts.push(factLabel);
				} else {
					// Process sources for this fact
					const entries: SourceEntry[] = [];

					for (const sourceLink of fact.sources) {
						const sourceNote = this.resolveSourceLink(sourceLink, sourceService);
						if (sourceNote) {
							allSourceCrIds.add(sourceNote.crId);

							const quality: ReportQuality = getSourceQuality(sourceNote);
							if (quality === 'primary') primaryCount++;
							else if (quality === 'secondary') secondaryCount++;
							else if (quality === 'derivative') derivativeCount++;

							// Track repository
							if (sourceNote.repository) {
								repositoryMap.set(
									sourceNote.repository,
									(repositoryMap.get(sourceNote.repository) || 0) + 1
								);
							}

							entries.push({
								crId: sourceNote.crId,
								title: sourceNote.title,
								sourceType: sourceNote.sourceType,
								quality,
								citation: sourceNote.citationOverride,
								repository: sourceNote.repository,
								factTypes: [factLabel]
							});
						}
					}

					if (entries.length > 0) {
						sourcesByFactType[factLabel] = entries;
					}
				}
			}
		}

		// If no coverage data, scan for direct source links in the person note
		if (!coverage) {
			warnings.push('No fact-level source tracking data found. Consider adding sourced_* properties.');
		}

		// Optionally include children's sources
		if (options.includeChildrenSources) {
			for (const childCrId of personNode.childrenCrIds) {
				const childCoverage = evidenceService.getFactCoverage(childCrId);
				if (childCoverage) {
					// Add a note about child sources
					const childNode = familyGraph.getPersonByCrId(childCrId);
					const childName = childNode?.name || childCrId;

					for (const fact of childCoverage.facts) {
						if (fact.status !== 'unsourced') {
							const factLabel = `${FACT_KEY_LABELS[fact.factKey]} (${childName})`;

							const entries: SourceEntry[] = [];
							for (const sourceLink of fact.sources) {
								const sourceNote = this.resolveSourceLink(sourceLink, sourceService);
								if (sourceNote && !allSourceCrIds.has(sourceNote.crId)) {
									allSourceCrIds.add(sourceNote.crId);
									const quality: ReportQuality = getSourceQuality(sourceNote);
									entries.push({
										crId: sourceNote.crId,
										title: sourceNote.title,
										sourceType: sourceNote.sourceType,
										quality,
										repository: sourceNote.repository,
										factTypes: [factLabel]
									});
								}
							}

							if (entries.length > 0) {
								sourcesByFactType[factLabel] = entries;
							}
						}
					}
				}
			}
		}

		// Build repository summary
		const repositories = Array.from(repositoryMap.entries())
			.map(([name, sourceCount]) => ({ name, sourceCount }))
			.sort((a, b) => b.sourceCount - a.sourceCount);

		const summary = {
			totalSources: allSourceCrIds.size,
			primaryCount,
			secondaryCount,
			derivativeCount,
			unsourcedFactCount: unsourcedFacts.length
		};

		// Generate markdown content
		const content = this.generateMarkdown(
			person,
			summary,
			sourcesByFactType,
			unsourcedFacts,
			repositories,
			options
		);

		const suggestedFilename = `Source Summary - ${person.name}.md`;

		return {
			success: true,
			content,
			suggestedFilename: this.sanitizeFilename(suggestedFilename),
			stats: {
				peopleCount: 1,
				eventsCount: 0,
				sourcesCount: allSourceCrIds.size
			},
			warnings,
			person,
			summary,
			sourcesByFactType,
			unsourcedFacts,
			repositories
		};
	}

	/**
	 * Resolve a wikilink to a source note
	 */
	private resolveSourceLink(link: string, sourceService: SourceService): SourceNote | undefined {
		// Extract note name from wikilink: [[Note]] or [[Note|Alias]]
		const match = link.match(/^\[\[([^\]|]+)(?:\|[^\]]+)?\]\]$/);
		if (!match) return undefined;

		const noteName = match[1];

		// Find the source note by path or title
		const sources = sourceService.getAllSources();

		// Try exact match on filename (without extension)
		const byPath = sources.find(s => {
			const fileName = s.filePath.split('/').pop()?.replace('.md', '');
			return fileName === noteName;
		});
		if (byPath) return byPath;

		// Try match on title
		const byTitle = sources.find(s => s.title === noteName);
		if (byTitle) return byTitle;

		return undefined;
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
	 * Generate markdown content for the Source Summary
	 */
	private generateMarkdown(
		person: ReportPerson,
		summary: {
			totalSources: number;
			primaryCount: number;
			secondaryCount: number;
			derivativeCount: number;
			unsourcedFactCount: number;
		},
		sourcesByFactType: Record<string, SourceEntry[]>,
		unsourcedFacts: string[],
		repositories: Array<{ name: string; sourceCount: number }>,
		options: SourceSummaryOptions
	): string {
		const lines: string[] = [];
		const date = new Date().toLocaleDateString();

		// Title
		lines.push(`# Source Summary: ${person.name}`);
		lines.push('');
		lines.push(`Generated: ${date}`);
		lines.push('');

		// Summary
		lines.push('## Summary');
		lines.push('');
		lines.push(`- **Total sources:** ${summary.totalSources}`);
		if (options.showQualityRatings) {
			lines.push(`- **Primary sources:** ${summary.primaryCount}`);
			lines.push(`- **Secondary sources:** ${summary.secondaryCount}`);
			lines.push(`- **Derivative sources:** ${summary.derivativeCount}`);
		}
		if (options.highlightGaps) {
			lines.push(`- **Unsourced facts:** ${summary.unsourcedFactCount}`);
		}
		lines.push('');

		// Sources by fact type
		const factTypes = Object.keys(sourcesByFactType);
		if (factTypes.length > 0) {
			lines.push('## Sources by fact');
			lines.push('');

			for (const factType of factTypes) {
				const entries = sourcesByFactType[factType];
				lines.push(`### ${factType}`);
				lines.push('');

				if (options.showQualityRatings) {
					lines.push('| Source | Type | Quality |');
					lines.push('|--------|------|---------|');
				} else {
					lines.push('| Source | Type |');
					lines.push('|--------|------|');
				}

				for (const entry of entries) {
					const sourceLink = `[[${entry.title}]]`;
					const type = entry.sourceType || '';
					const quality = this.formatQuality(entry.quality);

					if (options.showQualityRatings) {
						lines.push(`| ${sourceLink} | ${type} | ${quality} |`);
					} else {
						lines.push(`| ${sourceLink} | ${type} |`);
					}
				}
				lines.push('');
			}
		}

		// Unsourced facts (gaps)
		if (options.highlightGaps && unsourcedFacts.length > 0) {
			lines.push('## Research gaps');
			lines.push('');
			lines.push('The following facts have no source citations:');
			lines.push('');
			for (const fact of unsourcedFacts) {
				lines.push(`- [ ] ${fact}`);
			}
			lines.push('');
		}

		// Repository summary
		if (options.showRepositoryInfo && repositories.length > 0) {
			lines.push('## Repositories');
			lines.push('');
			lines.push('| Repository | Sources |');
			lines.push('|------------|---------|');
			for (const repo of repositories) {
				lines.push(`| ${repo.name} | ${repo.sourceCount} |`);
			}
			lines.push('');
		}

		// Footer
		lines.push('---');
		lines.push('*Generated by Charted Roots*');

		return lines.join('\n');
	}

	/**
	 * Format quality level for display
	 */
	private formatQuality(quality?: 'primary' | 'secondary' | 'derivative' | 'undetermined'): string {
		if (!quality) return '';
		switch (quality) {
			case 'primary':
				return 'Primary';
			case 'secondary':
				return 'Secondary';
			case 'derivative':
				return 'Derivative';
			case 'undetermined':
				return 'Undetermined';
			default:
				return quality;
		}
	}

	/**
	 * Create an error result
	 */
	private errorResult(error: string): SourceSummaryResult {
		return {
			success: false,
			content: '',
			suggestedFilename: 'source-summary.md',
			stats: { peopleCount: 0, eventsCount: 0, sourcesCount: 0 },
			error,
			warnings: [],
			person: { crId: '', name: 'Unknown', filePath: '' },
			summary: {
				totalSources: 0,
				primaryCount: 0,
				secondaryCount: 0,
				derivativeCount: 0,
				unsourcedFactCount: 0
			},
			sourcesByFactType: {},
			unsourcedFacts: [],
			repositories: []
		};
	}

	/**
	 * Sanitize a filename by removing invalid characters
	 */
	private sanitizeFilename(filename: string): string {
		return filename.replace(/[<>:"/\\|?*]/g, '-');
	}
}
