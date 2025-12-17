/**
 * Cross-Import Duplicate Detection Service
 *
 * Compares staging files against main tree to find potential duplicates
 * before promoting imports.
 */

import { App, TFile } from 'obsidian';
import type { CanvasRootsSettings } from '../settings';
import { FamilyGraphService, PersonNode } from './family-graph';
import { FolderFilterService } from './folder-filter';
import { StagingService } from './staging-service';
import { DuplicateMatch, DuplicateDetectionOptions } from './duplicate-detection';
import { getLogger } from './logging';

const logger = getLogger('CrossImportDetection');

/**
 * A cross-import match between staging and main tree
 */
export interface CrossImportMatch extends DuplicateMatch {
	/** The person from staging folder */
	stagingPerson: PersonNode;

	/** The person from main tree */
	mainPerson: PersonNode;

	/** Resolution status */
	resolution: 'same' | 'different' | 'pending';
}

/**
 * Resolution record for persisting decisions
 */
export interface ResolutionRecord {
	stagingCrId: string;
	mainCrId: string;
	resolution: 'same' | 'different';
	resolvedAt: string;
}

/**
 * Summary of cross-import detection results
 */
export interface CrossImportSummary {
	totalStagingPeople: number;
	matchedCount: number;
	unmatchedCount: number;
	resolvedSameCount: number;
	resolvedDifferentCount: number;
	pendingCount: number;
}

/**
 * Default detection options for cross-import
 */
const DEFAULT_OPTIONS: Required<DuplicateDetectionOptions> = {
	minConfidence: 60,
	minNameSimilarity: 70,
	maxYearDifference: 5,
	sameCollectionOnly: false
};

/**
 * Service for detecting duplicates between staging and main tree
 */
export class CrossImportDetectionService {
	private resolutions: Map<string, ResolutionRecord> = new Map();

	constructor(
		private app: App,
		private settings: CanvasRootsSettings,
		private folderFilter: FolderFilterService,
		private stagingService: StagingService
	) {}

	/**
	 * Load stored resolution decisions
	 */
	loadResolutions(records: ResolutionRecord[]): void {
		this.resolutions.clear();
		for (const record of records) {
			const key = this.makeResolutionKey(record.stagingCrId, record.mainCrId);
			this.resolutions.set(key, record);
		}
		logger.info('load', `Loaded ${records.length} resolution records`);
	}

	/**
	 * Get all stored resolutions for persistence
	 */
	getResolutions(): ResolutionRecord[] {
		return Array.from(this.resolutions.values());
	}

	/**
	 * Find matches between staging and main tree
	 */
	findCrossImportMatches(
		subfolderPath?: string,
		options: DuplicateDetectionOptions = {}
	): CrossImportMatch[] {
		const opts = { ...DEFAULT_OPTIONS, ...options };
		const matches: CrossImportMatch[] = [];

		// Get staging people
		const stagingPeople = this.getStagingPeople(subfolderPath);
		if (stagingPeople.length === 0) {
			logger.info('detection', 'No staging people found');
			return [];
		}

		// Get main tree people (using folder filter to exclude staging)
		const mainPeople = this.getMainTreePeople();
		if (mainPeople.length === 0) {
			logger.info('detection', 'No main tree people found');
			return [];
		}

		logger.info('detection',
			`Comparing ${stagingPeople.length} staging people against ${mainPeople.length} main tree people`
		);

		// Compare each staging person against main tree
		for (const stagingPerson of stagingPeople) {
			for (const mainPerson of mainPeople) {
				const match = this.calculateMatch(stagingPerson, mainPerson, opts);

				if (match && match.confidence >= opts.minConfidence) {
					// Check for existing resolution
					const resolution = this.getResolution(
						stagingPerson.crId || '',
						mainPerson.crId || ''
					);

					matches.push({
						...match,
						person1: stagingPerson,
						person2: mainPerson,
						stagingPerson,
						mainPerson,
						resolution: resolution?.resolution || 'pending'
					});
				}
			}
		}

		// Sort by confidence (highest first)
		matches.sort((a, b) => b.confidence - a.confidence);

		logger.info('detection', `Found ${matches.length} cross-import matches`);
		return matches;
	}

	/**
	 * Get staging files that have no match in main tree (safe to promote)
	 */
	getUnmatchedStagingFiles(
		subfolderPath?: string,
		options: DuplicateDetectionOptions = {}
	): TFile[] {
		const matches = this.findCrossImportMatches(subfolderPath, options);
		const matchedCrIds = new Set(matches.map(m => m.stagingPerson.crId));

		const stagingFiles = subfolderPath
			? this.getStagingFilesInSubfolder(subfolderPath)
			: this.stagingService.getStagingPersonFiles();

		return stagingFiles.filter(file => {
			const cache = this.app.metadataCache.getFileCache(file);
			const crId = cache?.frontmatter?.cr_id;
			return !matchedCrIds.has(crId);
		});
	}

	/**
	 * Get staging files with potential matches (need review)
	 */
	getMatchedStagingFiles(
		subfolderPath?: string,
		options: DuplicateDetectionOptions = {}
	): TFile[] {
		const matches = this.findCrossImportMatches(subfolderPath, options);
		const matchedCrIds = new Set(matches.map(m => m.stagingPerson.crId));

		const stagingFiles = subfolderPath
			? this.getStagingFilesInSubfolder(subfolderPath)
			: this.stagingService.getStagingPersonFiles();

		return stagingFiles.filter(file => {
			const cache = this.app.metadataCache.getFileCache(file);
			const crId = cache?.frontmatter?.cr_id;
			return matchedCrIds.has(crId);
		});
	}

	/**
	 * Record a resolution decision
	 */
	setResolution(
		stagingCrId: string,
		mainCrId: string,
		resolution: 'same' | 'different'
	): void {
		const key = this.makeResolutionKey(stagingCrId, mainCrId);
		const record: ResolutionRecord = {
			stagingCrId,
			mainCrId,
			resolution,
			resolvedAt: new Date().toISOString()
		};
		this.resolutions.set(key, record);
		logger.info('resolution', `Set resolution: ${stagingCrId} <-> ${mainCrId} = ${resolution}`);
	}

	/**
	 * Get resolution for a staging/main pair
	 */
	getResolution(stagingCrId: string, mainCrId: string): ResolutionRecord | undefined {
		const key = this.makeResolutionKey(stagingCrId, mainCrId);
		return this.resolutions.get(key);
	}

	/**
	 * Clear resolution for a staging/main pair
	 */
	clearResolution(stagingCrId: string, mainCrId: string): void {
		const key = this.makeResolutionKey(stagingCrId, mainCrId);
		this.resolutions.delete(key);
	}

	/**
	 * Get summary statistics for cross-import matches
	 */
	getSummary(
		subfolderPath?: string,
		options: DuplicateDetectionOptions = {}
	): CrossImportSummary {
		const matches = this.findCrossImportMatches(subfolderPath, options);
		const stagingPeople = this.getStagingPeople(subfolderPath);

		// Get unique staging people with matches
		const matchedStagingCrIds = new Set(matches.map(m => m.stagingPerson.crId));

		// Count resolutions
		let resolvedSameCount = 0;
		let resolvedDifferentCount = 0;
		let pendingCount = 0;

		for (const match of matches) {
			switch (match.resolution) {
				case 'same':
					resolvedSameCount++;
					break;
				case 'different':
					resolvedDifferentCount++;
					break;
				default:
					pendingCount++;
			}
		}

		return {
			totalStagingPeople: stagingPeople.length,
			matchedCount: matchedStagingCrIds.size,
			unmatchedCount: stagingPeople.length - matchedStagingCrIds.size,
			resolvedSameCount,
			resolvedDifferentCount,
			pendingCount
		};
	}

	/**
	 * Get files that are safe to promote (no matches or resolved as different)
	 */
	getPromotableStagingFiles(
		subfolderPath?: string,
		options: DuplicateDetectionOptions = {}
	): TFile[] {
		const matches = this.findCrossImportMatches(subfolderPath, options);

		// Files with unresolved "same" matches should not be promoted
		const blockedCrIds = new Set(
			matches
				.filter(m => m.resolution === 'same' || m.resolution === 'pending')
				.map(m => m.stagingPerson.crId)
		);

		const stagingFiles = subfolderPath
			? this.getStagingFilesInSubfolder(subfolderPath)
			: this.stagingService.getStagingPersonFiles();

		return stagingFiles.filter(file => {
			const cache = this.app.metadataCache.getFileCache(file);
			const crId = cache?.frontmatter?.cr_id;
			return !blockedCrIds.has(crId);
		});
	}

	/**
	 * Get people from staging folder
	 */
	private getStagingPeople(subfolderPath?: string): PersonNode[] {
		// Get staging files
		const stagingFiles = subfolderPath
			? this.getStagingFilesInSubfolder(subfolderPath)
			: this.stagingService.getStagingPersonFiles();

		// Build person nodes from staging files
		const people: PersonNode[] = [];
		for (const file of stagingFiles) {
			const person = this.buildPersonNode(file);
			if (person) {
				people.push(person);
			}
		}

		return people;
	}

	/**
	 * Get files in a specific staging subfolder
	 */
	private getStagingFilesInSubfolder(subfolderPath: string): TFile[] {
		const normalizedPath = subfolderPath.toLowerCase().replace(/^\/|\/$/g, '');

		return this.stagingService.getStagingFiles().filter(file => {
			const filePath = file.path.toLowerCase();
			return filePath.startsWith(normalizedPath + '/');
		});
	}

	/**
	 * Get people from main tree (excluding staging)
	 */
	private getMainTreePeople(): PersonNode[] {
		const graphService = new FamilyGraphService(this.app);
		graphService.setFolderFilter(this.folderFilter);

		// FamilyGraphService with folder filter will exclude staging
		graphService['loadPersonCache']();
		return graphService.getAllPeople();
	}

	/**
	 * Build a PersonNode from a file
	 */
	private buildPersonNode(file: TFile): PersonNode | null {
		const cache = this.app.metadataCache.getFileCache(file);
		if (!cache?.frontmatter?.cr_id) {
			return null;
		}

		const fm = cache.frontmatter;

		return {
			crId: fm.cr_id,
			name: typeof fm.name === 'string' ? fm.name : file.basename,
			file,
			sex: fm.gender,
			birthDate: fm.born,
			deathDate: fm.died,
			fatherCrId: this.extractCrId(fm.father),
			motherCrId: this.extractCrId(fm.mother),
			stepfatherCrIds: this.extractCrIds(fm.stepfather),
			stepmotherCrIds: this.extractCrIds(fm.stepmother),
			adoptiveFatherCrId: this.extractCrId(fm.adoptive_father),
			adoptiveMotherCrId: this.extractCrId(fm.adoptive_mother),
			spouseCrIds: this.extractCrIds(fm.spouse),
			childrenCrIds: this.extractCrIds(fm.children),
			collection: fm.collection
		};
	}

	/**
	 * Extract cr_id from a link value
	 */
	private extractCrId(value: unknown): string | undefined {
		if (!value) return undefined;
		if (typeof value === 'string') {
			// Handle [[link]] format
			const match = value.match(/\[\[([^\]|]+)/);
			return match ? match[1] : value;
		}
		return undefined;
	}

	/**
	 * Extract cr_ids from an array or single value
	 */
	private extractCrIds(value: unknown): string[] {
		if (!value) return [];
		if (Array.isArray(value)) {
			return value.map(v => this.extractCrId(v)).filter((id): id is string => !!id);
		}
		const id = this.extractCrId(value);
		return id ? [id] : [];
	}

	/**
	 * Calculate match score between two people
	 * Adapted from DuplicateDetectionService
	 */
	private calculateMatch(
		person1: PersonNode,
		person2: PersonNode,
		opts: Required<DuplicateDetectionOptions>
	): Omit<DuplicateMatch, 'person1' | 'person2'> | null {
		const reasons: string[] = [];

		// Calculate name similarity
		const nameSimilarity = this.calculateNameSimilarity(person1.name, person2.name);

		// Skip if name similarity is too low
		if (nameSimilarity < opts.minNameSimilarity) {
			return null;
		}

		if (nameSimilarity >= 90) {
			reasons.push('Names are nearly identical');
		} else if (nameSimilarity >= 80) {
			reasons.push('Names are very similar');
		} else {
			reasons.push('Names have some similarity');
		}

		// Calculate date proximity
		const dateProximity = this.calculateDateProximity(person1, person2, opts.maxYearDifference);

		if (dateProximity >= 90) {
			reasons.push('Birth/death dates match closely');
		} else if (dateProximity >= 70) {
			reasons.push('Birth/death dates are within range');
		}

		// Check for same gender
		if (person1.sex && person2.sex && person1.sex === person2.sex) {
			reasons.push('Same gender');
		}

		// Calculate overall confidence
		let confidence = nameSimilarity * 0.6 + dateProximity * 0.3;

		if (person1.sex && person2.sex && person1.sex === person2.sex) {
			confidence += 5;
		}

		confidence = Math.min(Math.round(confidence), 100);

		return {
			confidence,
			nameSimilarity: Math.round(nameSimilarity),
			dateProximity: Math.round(dateProximity),
			reasons
		};
	}

	/**
	 * Calculate name similarity using Levenshtein distance
	 */
	private calculateNameSimilarity(name1: string | undefined, name2: string | undefined): number {
		if (!name1 || !name2) return 0;

		const n1 = this.normalizeName(name1);
		const n2 = this.normalizeName(name2);

		if (n1 === n2) return 100;

		const distance = this.levenshteinDistance(n1, n2);
		const maxLength = Math.max(n1.length, n2.length);

		if (maxLength === 0) return 100;

		const similarity = (1 - distance / maxLength) * 100;
		const rearrangedSimilarity = this.checkRearrangedNames(n1, n2);

		return Math.max(similarity, rearrangedSimilarity);
	}

	/**
	 * Normalize a name for comparison
	 */
	private normalizeName(name: string): string {
		return name
			.toLowerCase()
			.replace(/[,.'"-]/g, ' ')
			.replace(/\s+/g, ' ')
			.trim();
	}

	/**
	 * Check if two names might be rearranged
	 */
	private checkRearrangedNames(name1: string, name2: string): number {
		const parts1 = name1.split(' ').filter(p => p.length > 0).sort();
		const parts2 = name2.split(' ').filter(p => p.length > 0).sort();

		if (parts1.length !== parts2.length) return 0;

		let matchingParts = 0;
		for (let i = 0; i < parts1.length; i++) {
			if (parts1[i] === parts2[i]) {
				matchingParts++;
			}
		}

		return (matchingParts / parts1.length) * 100;
	}

	/**
	 * Calculate Levenshtein distance
	 */
	private levenshteinDistance(str1: string, str2: string): number {
		const m = str1.length;
		const n = str2.length;

		const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

		for (let i = 0; i <= m; i++) dp[i][0] = i;
		for (let j = 0; j <= n; j++) dp[0][j] = j;

		for (let i = 1; i <= m; i++) {
			for (let j = 1; j <= n; j++) {
				const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
				dp[i][j] = Math.min(
					dp[i - 1][j] + 1,
					dp[i][j - 1] + 1,
					dp[i - 1][j - 1] + cost
				);
			}
		}

		return dp[m][n];
	}

	/**
	 * Calculate date proximity score
	 */
	private calculateDateProximity(
		person1: PersonNode,
		person2: PersonNode,
		maxYearDiff: number
	): number {
		let totalScore = 0;
		let comparisons = 0;

		if (person1.birthDate && person2.birthDate) {
			const year1 = this.extractYear(person1.birthDate);
			const year2 = this.extractYear(person2.birthDate);

			if (year1 && year2) {
				const diff = Math.abs(year1 - year2);
				if (diff <= maxYearDiff) {
					totalScore += 100 - (diff / maxYearDiff) * 100;
				}
				comparisons++;
			}
		}

		if (person1.deathDate && person2.deathDate) {
			const year1 = this.extractYear(person1.deathDate);
			const year2 = this.extractYear(person2.deathDate);

			if (year1 && year2) {
				const diff = Math.abs(year1 - year2);
				if (diff <= maxYearDiff) {
					totalScore += 100 - (diff / maxYearDiff) * 100;
				}
				comparisons++;
			}
		}

		if (comparisons === 0) {
			return 50;
		}

		return totalScore / comparisons;
	}

	/**
	 * Extract year from a date string
	 */
	private extractYear(dateStr: string): number | null {
		const match = dateStr.match(/\b(\d{4})\b/);
		if (match) {
			return parseInt(match[1], 10);
		}
		return null;
	}

	/**
	 * Create a unique key for a resolution
	 */
	private makeResolutionKey(stagingCrId: string, mainCrId: string): string {
		return `${stagingCrId}:${mainCrId}`;
	}
}
