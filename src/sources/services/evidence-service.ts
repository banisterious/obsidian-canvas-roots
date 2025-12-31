/**
 * Evidence Service for Research Visualization
 *
 * Provides fact-level source coverage analysis aligned with the
 * Genealogical Proof Standard (GPS) and professional genealogical practices.
 */

import { App, TFile } from 'obsidian';
import type { CanvasRootsSettings } from '../../settings';
import {
	SourceNote,
	SourcedFacts,
	FactKey,
	FactCoverage,
	FactCoverageStatus,
	PersonResearchCoverage,
	SourceQuality,
	FACT_KEYS,
	getSourceQuality,
	FACT_KEY_TO_SOURCED_PROPERTY,
	SOURCED_PROPERTY_NAMES
} from '../types/source-types';
import { SourceService } from './source-service';

/**
 * Summary of research gaps across all people
 */
export interface ResearchGapsSummary {
	/** Total people with any fact tracking data */
	totalPeopleTracked: number;
	/** People with no fact tracking data yet */
	totalPeopleUntracked: number;
	/** Count of unsourced facts by fact type */
	unsourcedByFact: Record<FactKey, number>;
	/** Count of weakly sourced facts (secondary/derivative only) */
	weaklySourcedByFact: Record<FactKey, number>;
	/** People sorted by coverage percent (lowest first) */
	lowestCoverage: PersonResearchCoverage[];
}

/**
 * Service for analyzing evidence and research coverage
 */
export class EvidenceService {
	private app: App;
	private settings: CanvasRootsSettings;
	private sourceService: SourceService;

	constructor(app: App, settings: CanvasRootsSettings) {
		this.app = app;
		this.settings = settings;
		this.sourceService = new SourceService(app, settings);
	}

	/**
	 * Update settings reference (called when settings change)
	 */
	updateSettings(settings: CanvasRootsSettings): void {
		this.settings = settings;
		this.sourceService.updateSettings(settings);
	}

	/**
	 * Get fact coverage for a person by their cr_id
	 */
	getFactCoverage(personCrId: string): PersonResearchCoverage | null {
		const file = this.findPersonFileByCrId(personCrId);
		if (!file) return null;

		return this.getFactCoverageForFile(file);
	}

	/**
	 * Get fact coverage for a person by their file path
	 */
	getFactCoverageByPath(filePath: string): PersonResearchCoverage | null {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) return null;

		return this.getFactCoverageForFile(file);
	}

	/**
	 * Get fact coverage for a person file
	 */
	getFactCoverageForFile(file: TFile): PersonResearchCoverage | null {
		const cache = this.app.metadataCache.getFileCache(file);
		if (!cache?.frontmatter) return null;

		const fm = cache.frontmatter;

		// Must have cr_id (is a person note)
		const crId = fm.cr_id as string | undefined;
		if (!crId) return null;

		const name = (fm.name as string) || file.basename;

		// Read from both legacy sourced_facts and new flat sourced_* properties
		const legacySourcedFacts = fm.sourced_facts as SourcedFacts | undefined;

		// Calculate coverage for each fact
		const facts: FactCoverage[] = [];
		let sourcedCount = 0;

		for (const factKey of FACT_KEYS) {
			// Get sources from new flat property (preferred)
			const flatPropertyName = FACT_KEY_TO_SOURCED_PROPERTY[factKey];
			const flatSources = this.normalizeSourcesToArray(fm[flatPropertyName]);

			// Fall back to legacy sourced_facts if no flat property data
			const coverage = flatSources.length > 0
				? this.calculateFactCoverageFromSources(factKey, flatSources)
				: this.calculateFactCoverage(factKey, legacySourcedFacts);

			facts.push(coverage);
			if (coverage.status !== 'unsourced') {
				sourcedCount++;
			}
		}

		const coveragePercent = Math.round((sourcedCount / FACT_KEYS.length) * 100);

		return {
			personCrId: crId,
			personName: name,
			filePath: file.path,
			coveragePercent,
			sourcedFactCount: sourcedCount,
			totalFactCount: FACT_KEYS.length,
			facts
		};
	}

	/**
	 * Normalize a frontmatter value to an array of source wikilinks
	 * Handles string, array, or undefined values
	 */
	private normalizeSourcesToArray(value: unknown): string[] {
		if (!value) return [];
		if (Array.isArray(value)) return value.map(v => typeof v === 'string' ? v : JSON.stringify(v));
		return [typeof value === 'string' ? value : JSON.stringify(value)];
	}

	/**
	 * Calculate coverage status for a fact from a list of source wikilinks
	 * Used for new flat sourced_* properties
	 */
	private calculateFactCoverageFromSources(factKey: FactKey, sources: string[]): FactCoverage {
		// Empty array means explicitly tracked as unsourced
		if (sources.length === 0) {
			return {
				factKey,
				status: 'unsourced',
				sourceCount: 0,
				sources: []
			};
		}

		// Has sources - determine quality
		const qualities = this.getSourceQualities(sources);
		const bestQuality = this.getBestQuality(qualities);
		const hasPrimary = qualities.includes('primary');

		let status: FactCoverageStatus;
		if (sources.length >= 2 && hasPrimary) {
			status = 'well-sourced';
		} else if (hasPrimary) {
			status = 'sourced';
		} else {
			status = 'weakly-sourced';
		}

		return {
			factKey,
			status,
			sourceCount: sources.length,
			bestQuality,
			sources
		};
	}

	/**
	 * Get research gaps summary across all people
	 */
	getResearchGaps(limit = 50): ResearchGapsSummary {
		const summary: ResearchGapsSummary = {
			totalPeopleTracked: 0,
			totalPeopleUntracked: 0,
			unsourcedByFact: {} as Record<FactKey, number>,
			weaklySourcedByFact: {} as Record<FactKey, number>,
			lowestCoverage: []
		};

		// Initialize counts
		for (const factKey of FACT_KEYS) {
			summary.unsourcedByFact[factKey] = 0;
			summary.weaklySourcedByFact[factKey] = 0;
		}

		const allCoverage: PersonResearchCoverage[] = [];
		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			const coverage = this.getFactCoverageForFile(file);
			if (!coverage) continue;

			// Check if person has any sourced_facts data (legacy or new flat properties)
			const cache = this.app.metadataCache.getFileCache(file);
			const hasTracking = this.hasAnyFactTracking(cache?.frontmatter);

			if (hasTracking) {
				summary.totalPeopleTracked++;
			} else {
				summary.totalPeopleUntracked++;
			}

			// Count unsourced and weakly sourced facts
			// ONLY for people who have started GPS tracking (have sourced_facts property)
			if (hasTracking) {
				for (const fact of coverage.facts) {
					if (fact.status === 'unsourced') {
						summary.unsourcedByFact[fact.factKey]++;
					} else if (fact.status === 'weakly-sourced') {
						summary.weaklySourcedByFact[fact.factKey]++;
					}
				}
			}

			allCoverage.push(coverage);
		}

		// Sort by coverage percent (lowest first) and take limit
		allCoverage.sort((a, b) => a.coveragePercent - b.coveragePercent);
		summary.lowestCoverage = allCoverage.slice(0, limit);

		return summary;
	}

	/**
	 * Get all people with unsourced facts for a specific fact type
	 */
	getPeopleWithUnsourcedFact(factKey: FactKey): PersonResearchCoverage[] {
		const results: PersonResearchCoverage[] = [];
		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			const coverage = this.getFactCoverageForFile(file);
			if (!coverage) continue;

			const fact = coverage.facts.find(f => f.factKey === factKey);
			if (fact && fact.status === 'unsourced') {
				results.push(coverage);
			}
		}

		// Sort by name
		results.sort((a, b) => a.personName.localeCompare(b.personName));

		return results;
	}

	/**
	 * Get all people with weakly sourced facts (secondary/derivative only)
	 */
	getPeopleWithWeaklySourcingFact(factKey: FactKey): PersonResearchCoverage[] {
		const results: PersonResearchCoverage[] = [];
		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			const coverage = this.getFactCoverageForFile(file);
			if (!coverage) continue;

			const fact = coverage.facts.find(f => f.factKey === factKey);
			if (fact && fact.status === 'weakly-sourced') {
				results.push(coverage);
			}
		}

		// Sort by name
		results.sort((a, b) => a.personName.localeCompare(b.personName));

		return results;
	}

	/**
	 * Calculate coverage status for a single fact
	 */
	private calculateFactCoverage(factKey: FactKey, sourcedFacts?: SourcedFacts): FactCoverage {
		// No tracking data at all
		if (!sourcedFacts || !sourcedFacts[factKey]) {
			return {
				factKey,
				status: 'unsourced',
				sourceCount: 0,
				sources: []
			};
		}

		// TypeScript doesn't narrow index signatures, so we use non-null assertion
		// since we already checked !sourcedFacts[factKey] above
		const entry = sourcedFacts[factKey]!;
		const sources = entry.sources || [];

		// Explicitly tracked as unsourced (empty array)
		if (sources.length === 0) {
			return {
				factKey,
				status: 'unsourced',
				sourceCount: 0,
				sources: []
			};
		}

		// Has sources - determine quality
		const qualities = this.getSourceQualities(sources);
		const bestQuality = this.getBestQuality(qualities);
		const hasPrimary = qualities.includes('primary');

		let status: FactCoverageStatus;
		if (sources.length >= 2 && hasPrimary) {
			status = 'well-sourced';
		} else if (hasPrimary) {
			status = 'sourced';
		} else {
			status = 'weakly-sourced';
		}

		return {
			factKey,
			status,
			sourceCount: sources.length,
			bestQuality,
			sources
		};
	}

	/**
	 * Get the quality ratings for a list of source wikilinks
	 */
	private getSourceQualities(sourceLinks: string[]): SourceQuality[] {
		const qualities: SourceQuality[] = [];

		for (const link of sourceLinks) {
			// Extract note name from wikilink: [[Note]] or [[Note|Alias]]
			const match = link.match(/^\[\[([^\]|]+)(?:\|[^\]]+)?\]\]$/);
			if (!match) continue;

			const noteName = match[1];

			// Find the source note
			const source = this.findSourceByName(noteName);
			if (source) {
				qualities.push(getSourceQuality(source));
			} else {
				// Source not found, assume secondary
				qualities.push('secondary');
			}
		}

		return qualities;
	}

	/**
	 * Get the best (highest) quality from a list
	 */
	private getBestQuality(qualities: SourceQuality[]): SourceQuality | undefined {
		if (qualities.length === 0) return undefined;

		// Primary > Secondary > Derivative
		if (qualities.includes('primary')) return 'primary';
		if (qualities.includes('secondary')) return 'secondary';
		return 'derivative';
	}

	/**
	 * Find a source note by name (for resolving wikilinks)
	 */
	private findSourceByName(name: string): SourceNote | undefined {
		const sources = this.sourceService.getAllSources();

		// Try exact match on filename (without extension)
		const byPath = sources.find(s => {
			const fileName = s.filePath.split('/').pop()?.replace('.md', '');
			return fileName === name;
		});
		if (byPath) return byPath;

		// Try match on title
		const byTitle = sources.find(s => s.title === name);
		if (byTitle) return byTitle;

		return undefined;
	}

	/**
	 * Check if frontmatter has any fact tracking data
	 * Checks both legacy sourced_facts and new flat sourced_* properties
	 */
	private hasAnyFactTracking(frontmatter: Record<string, unknown> | undefined): boolean {
		if (!frontmatter) return false;

		// Check legacy sourced_facts
		if (frontmatter.sourced_facts !== undefined) {
			return true;
		}

		// Check any of the new flat sourced_* properties
		for (const propName of SOURCED_PROPERTY_NAMES) {
			if (frontmatter[propName] !== undefined) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Find a person file by cr_id
	 */
	private findPersonFileByCrId(crId: string): TFile | null {
		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (cache?.frontmatter?.cr_id === crId) {
				return file;
			}
		}

		return null;
	}
}
