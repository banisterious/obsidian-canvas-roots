/**
 * Smart Duplicate Detection Service
 *
 * Finds potential duplicate person records using fuzzy name matching,
 * date proximity analysis, and confidence scoring.
 */

import { App } from 'obsidian';
import { FamilyGraphService, PersonNode } from './family-graph';
import { getLogger } from './logging';

const logger = getLogger('DuplicateDetection');

/**
 * A potential duplicate match with confidence scoring
 */
export interface DuplicateMatch {
	/** First person in the potential duplicate pair */
	person1: PersonNode;

	/** Second person in the potential duplicate pair */
	person2: PersonNode;

	/** Overall confidence score (0-100) */
	confidence: number;

	/** Name similarity score (0-100) */
	nameSimilarity: number;

	/** Date proximity score (0-100, higher = closer dates) */
	dateProximity: number;

	/** Reasons why this is flagged as potential duplicate */
	reasons: string[];
}

/**
 * Options for duplicate detection
 */
export interface DuplicateDetectionOptions {
	/** Minimum confidence threshold (0-100) to report a match */
	minConfidence?: number;

	/** Minimum name similarity (0-100) to consider */
	minNameSimilarity?: number;

	/** Maximum year difference for dates to be considered close */
	maxYearDifference?: number;

	/** Only check within same collection */
	sameCollectionOnly?: boolean;
}

/**
 * Default detection options
 */
const DEFAULT_OPTIONS: Required<DuplicateDetectionOptions> = {
	minConfidence: 60,
	minNameSimilarity: 70,
	maxYearDifference: 5,
	sameCollectionOnly: false
};

/**
 * Duplicate Detection Service
 */
export class DuplicateDetectionService {
	private app: App;
	private graphService: FamilyGraphService;

	constructor(app: App) {
		this.app = app;
		this.graphService = new FamilyGraphService(app);
	}

	/**
	 * Find all potential duplicates in the vault
	 */
	findDuplicates(options: DuplicateDetectionOptions = {}): DuplicateMatch[] {
		const opts = { ...DEFAULT_OPTIONS, ...options };
		const matches: DuplicateMatch[] = [];

		// Load all people
		this.graphService['loadPersonCache']();
		const allPeople = this.graphService.getAllPeople();

		logger.info('detection', `Scanning ${allPeople.length} people for duplicates`);

		// Compare each pair of people
		for (let i = 0; i < allPeople.length; i++) {
			for (let j = i + 1; j < allPeople.length; j++) {
				const person1 = allPeople[i];
				const person2 = allPeople[j];

				// Skip if same collection filter is enabled and collections differ
				if (opts.sameCollectionOnly && person1.collection !== person2.collection) {
					continue;
				}

				// Calculate match score
				const match = this.calculateMatch(person1, person2, opts);

				if (match && match.confidence >= opts.minConfidence) {
					matches.push(match);
				}
			}
		}

		// Sort by confidence (highest first)
		matches.sort((a, b) => b.confidence - a.confidence);

		logger.info('detection', `Found ${matches.length} potential duplicates`);
		return matches;
	}

	/**
	 * Calculate match score between two people
	 */
	private calculateMatch(
		person1: PersonNode,
		person2: PersonNode,
		opts: Required<DuplicateDetectionOptions>
	): DuplicateMatch | null {
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

		// Check for overlapping relationships
		const relationshipOverlap = this.checkRelationshipOverlap(person1, person2);
		if (relationshipOverlap > 0) {
			reasons.push(`${relationshipOverlap} shared relationship(s)`);
		}

		// Calculate overall confidence
		// Weighted formula: name (60%), dates (30%), other factors (10%)
		let confidence = nameSimilarity * 0.6 + dateProximity * 0.3;

		// Boost confidence for additional matching factors
		if (person1.sex && person2.sex && person1.sex === person2.sex) {
			confidence += 5;
		}
		if (relationshipOverlap > 0) {
			confidence += Math.min(relationshipOverlap * 3, 10);
		}

		// Cap at 100
		confidence = Math.min(Math.round(confidence), 100);

		return {
			person1,
			person2,
			confidence,
			nameSimilarity: Math.round(nameSimilarity),
			dateProximity: Math.round(dateProximity),
			reasons
		};
	}

	/**
	 * Calculate similarity between two names using Levenshtein distance
	 * Returns a score from 0-100
	 */
	private calculateNameSimilarity(name1: string | undefined, name2: string | undefined): number {
		if (!name1 || !name2) return 0;

		// Normalize names for comparison
		const n1 = this.normalizeName(name1);
		const n2 = this.normalizeName(name2);

		if (n1 === n2) return 100;

		// Calculate Levenshtein distance
		const distance = this.levenshteinDistance(n1, n2);
		const maxLength = Math.max(n1.length, n2.length);

		if (maxLength === 0) return 100;

		// Convert distance to similarity percentage
		const similarity = (1 - distance / maxLength) * 100;

		// Also check if names might be rearranged (e.g., "John Smith" vs "Smith, John")
		const rearrangedSimilarity = this.checkRearrangedNames(n1, n2);

		return Math.max(similarity, rearrangedSimilarity);
	}

	/**
	 * Normalize a name for comparison
	 */
	private normalizeName(name: string): string {
		return name
			.toLowerCase()
			.replace(/[,.'"-]/g, ' ')  // Remove punctuation
			.replace(/\s+/g, ' ')       // Normalize whitespace
			.trim();
	}

	/**
	 * Check if two names might be the same but rearranged
	 * (e.g., "John Smith" vs "Smith John" or "Smith, John")
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
	 * Calculate Levenshtein distance between two strings
	 */
	private levenshteinDistance(str1: string, str2: string): number {
		const m = str1.length;
		const n = str2.length;

		// Create a 2D array for dynamic programming
		const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

		// Initialize base cases
		for (let i = 0; i <= m; i++) dp[i][0] = i;
		for (let j = 0; j <= n; j++) dp[0][j] = j;

		// Fill in the rest of the matrix
		for (let i = 1; i <= m; i++) {
			for (let j = 1; j <= n; j++) {
				const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
				dp[i][j] = Math.min(
					dp[i - 1][j] + 1,      // deletion
					dp[i][j - 1] + 1,      // insertion
					dp[i - 1][j - 1] + cost // substitution
				);
			}
		}

		return dp[m][n];
	}

	/**
	 * Calculate date proximity score between two people
	 * Returns 0-100 based on how close birth/death dates are
	 */
	private calculateDateProximity(
		person1: PersonNode,
		person2: PersonNode,
		maxYearDiff: number
	): number {
		let totalScore = 0;
		let comparisons = 0;

		// Compare birth dates
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

		// Compare death dates
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

		// If we have no date comparisons, return neutral score
		if (comparisons === 0) {
			return 50; // Neutral - dates unknown
		}

		return totalScore / comparisons;
	}

	/**
	 * Extract year from a date string
	 */
	private extractYear(dateStr: string): number | null {
		// Try to match 4-digit year
		const match = dateStr.match(/\b(\d{4})\b/);
		if (match) {
			return parseInt(match[1], 10);
		}
		return null;
	}

	/**
	 * Check for overlapping relationships between two people
	 * Returns count of shared relatives
	 */
	private checkRelationshipOverlap(person1: PersonNode, person2: PersonNode): number {
		let overlap = 0;

		// Check shared parents
		if (person1.fatherCrId && person1.fatherCrId === person2.fatherCrId) overlap++;
		if (person1.motherCrId && person1.motherCrId === person2.motherCrId) overlap++;

		// Check shared spouses
		for (const spouse1 of person1.spouseCrIds) {
			if (person2.spouseCrIds.includes(spouse1)) {
				overlap++;
			}
		}

		// Check shared children
		for (const child1 of person1.childrenCrIds) {
			if (person2.childrenCrIds.includes(child1)) {
				overlap++;
			}
		}

		return overlap;
	}

	/**
	 * Get summary statistics about duplicates
	 */
	getSummary(matches: DuplicateMatch[]): {
		totalMatches: number;
		highConfidence: number;
		mediumConfidence: number;
		lowConfidence: number;
	} {
		return {
			totalMatches: matches.length,
			highConfidence: matches.filter(m => m.confidence >= 80).length,
			mediumConfidence: matches.filter(m => m.confidence >= 60 && m.confidence < 80).length,
			lowConfidence: matches.filter(m => m.confidence < 60).length
		};
	}
}
