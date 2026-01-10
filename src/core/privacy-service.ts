/**
 * Privacy Service for Charted Roots
 *
 * Provides privacy protection for living persons in genealogical data.
 * Determines if a person is likely living and applies obfuscation rules.
 *
 * Also provides utilities for filtering sensitive fields (SSN, identity numbers, etc.)
 * that should never be included in exports regardless of living status.
 */

import { getLogger } from './logging';

const logger = getLogger('privacy');

/**
 * Fields that contain sensitive personal information and should be
 * redacted from exports regardless of living status.
 *
 * These map to GEDCOM attributes:
 * - ssn: Social Security Number (GEDCOM SSN)
 * - identityNumber: National identity number (GEDCOM IDNO)
 *
 * Note: Current exporters work with PersonNode interface which doesn't
 * include these fields, providing implicit protection. These utilities
 * are for explicit filtering when working with raw frontmatter.
 */
export const SENSITIVE_FIELDS = new Set([
	'ssn',
	'identityNumber',
	'identity_number',  // Alternate casing
	'socialSecurityNumber',  // Alternate naming
	'social_security_number',
]);

/**
 * Check if a field name is sensitive and should be redacted
 */
export function isSensitiveField(fieldName: string): boolean {
	return SENSITIVE_FIELDS.has(fieldName);
}

/**
 * Filter sensitive fields from a frontmatter object.
 * Returns a new object with sensitive fields removed.
 */
export function filterSensitiveFields<T extends Record<string, unknown>>(
	frontmatter: T
): Omit<T, 'ssn' | 'identityNumber' | 'identity_number' | 'socialSecurityNumber' | 'social_security_number'> {
	const filtered = { ...frontmatter };
	for (const field of SENSITIVE_FIELDS) {
		delete filtered[field];
	}
	return filtered;
}

export interface PrivacySettings {
	enablePrivacyProtection: boolean;
	livingPersonAgeThreshold: number;
	privacyDisplayFormat: 'living' | 'private' | 'initials' | 'hidden';
	hideDetailsForLiving: boolean;
}

export interface PersonPrivacyData {
	name: string;
	birthDate?: string;
	deathDate?: string;
	/** Manual override for living status. When set, bypasses automatic detection. */
	cr_living?: boolean;
}

export interface PrivacyResult {
	isProtected: boolean;
	displayName: string;
	showBirthDate: boolean;
	showBirthPlace: boolean;
	showDeathDate: boolean;
	showDeathPlace: boolean;
	excludeFromOutput: boolean;
}

/**
 * Service for applying privacy rules to person data
 */
export class PrivacyService {
	private settings: PrivacySettings;

	constructor(settings: PrivacySettings) {
		this.settings = settings;
	}

	/**
	 * Update settings (e.g., when user changes them)
	 */
	updateSettings(settings: PrivacySettings): void {
		this.settings = settings;
	}

	/**
	 * Determine if a person is likely living based on available data.
	 * The cr_living frontmatter property takes precedence over automatic detection.
	 */
	isLikelyLiving(person: PersonPrivacyData): boolean {
		// If privacy protection is disabled, no one is protected
		if (!this.settings.enablePrivacyProtection) {
			return false;
		}

		// Manual override takes precedence over automatic detection
		if (person.cr_living !== undefined) {
			return person.cr_living;
		}

		// Automatic detection follows...

		// If they have a death date, they're not living
		if (person.deathDate && person.deathDate.trim() !== '') {
			return false;
		}

		// If no birth date, we can't determine - assume not living (conservative)
		if (!person.birthDate || person.birthDate.trim() === '') {
			return false;
		}

		// Parse birth year from birth date
		const birthYear = this.extractYear(person.birthDate);
		if (birthYear === null) {
			return false;
		}

		// Calculate age threshold
		const currentYear = new Date().getFullYear();
		const age = currentYear - birthYear;

		// If born within threshold years, assume living
		return age <= this.settings.livingPersonAgeThreshold;
	}

	/**
	 * Apply privacy rules to a person and return transformed data
	 */
	applyPrivacy(person: PersonPrivacyData): PrivacyResult {
		const isProtected = this.isLikelyLiving(person);

		if (!isProtected) {
			return {
				isProtected: false,
				displayName: person.name,
				showBirthDate: true,
				showBirthPlace: true,
				showDeathDate: true,
				showDeathPlace: true,
				excludeFromOutput: false
			};
		}

		// Person is protected - apply privacy rules
		logger.debug('privacy', `Applying privacy protection to: ${person.name}`);

		const displayName = this.getProtectedDisplayName(person.name);
		const hideDetails = this.settings.hideDetailsForLiving;
		const excludeFromOutput = this.settings.privacyDisplayFormat === 'hidden';

		return {
			isProtected: true,
			displayName,
			showBirthDate: !hideDetails,
			showBirthPlace: !hideDetails,
			showDeathDate: true, // Death date is fine to show (they don't have one anyway)
			showDeathPlace: true,
			excludeFromOutput
		};
	}

	/**
	 * Get the display name for a protected person based on settings
	 */
	private getProtectedDisplayName(originalName: string): string {
		switch (this.settings.privacyDisplayFormat) {
			case 'living':
				return 'Living';
			case 'private':
				return 'Private';
			case 'initials':
				return this.getInitials(originalName);
			case 'hidden':
				return ''; // Will be excluded from output
		}
	}

	/**
	 * Extract initials from a name
	 */
	private getInitials(name: string): string {
		const parts = name.trim().split(/\s+/);
		if (parts.length === 0) return '?';

		return parts
			.map(part => part.charAt(0).toUpperCase())
			.join('.');
	}

	/**
	 * Extract year from a date string
	 * Supports various formats including approximate dates:
	 * - Exact: YYYY, YYYY-MM-DD, DD MMM YYYY
	 * - Approximate: "about 1920", "abt 1920", "circa 1920", "~1920", "c.1920"
	 * - Range: "bet 1920 and 1930", "between 1920-1930", "1920-1930"
	 * - Before/After: "bef 1920", "before 1920", "aft 1920", "after 1920"
	 *
	 * For privacy purposes:
	 * - Ranges use the earlier year (conservative - assume born earlier)
	 * - "After" dates use the stated year (makes person appear younger, more likely protected)
	 * - "Before" dates use the stated year (conservative)
	 */
	private extractYear(dateString: string): number | null {
		if (!dateString) return null;

		const normalized = dateString.toLowerCase().trim();

		// Handle "between X and Y" or "bet X and Y" - use earlier year
		const betweenMatch = normalized.match(/(?:bet(?:ween)?)\s*(\d{4})\s*(?:and|-)\s*(\d{4})/);
		if (betweenMatch) {
			const year1 = parseInt(betweenMatch[1], 10);
			const year2 = parseInt(betweenMatch[2], 10);
			return Math.min(year1, year2);
		}

		// Handle date ranges like "1920-1930" - use earlier year
		const rangeMatch = normalized.match(/\b(\d{4})\s*[-–—]\s*(\d{4})\b/);
		if (rangeMatch) {
			const year1 = parseInt(rangeMatch[1], 10);
			const year2 = parseInt(rangeMatch[2], 10);
			// Only treat as range if second year is greater (not MM-DD format)
			if (year2 > year1) {
				return Math.min(year1, year2);
			}
		}

		// Handle "before" dates - use stated year (conservative)
		const beforeMatch = normalized.match(/(?:bef(?:ore)?)\s*(\d{4})/);
		if (beforeMatch) {
			return parseInt(beforeMatch[1], 10);
		}

		// Handle "after" dates - use stated year (person could be younger)
		const afterMatch = normalized.match(/(?:aft(?:er)?)\s*(\d{4})/);
		if (afterMatch) {
			return parseInt(afterMatch[1], 10);
		}

		// Handle approximate dates: "about", "abt", "circa", "c.", "~"
		const approxMatch = normalized.match(/(?:ab(?:ou)?t|circa|c\.|~)\s*(\d{4})/);
		if (approxMatch) {
			return parseInt(approxMatch[1], 10);
		}

		// Try to find any 4-digit year in the string (1800-2099)
		const yearMatch = dateString.match(/\b(1[89][0-9]{2}|20[0-9]{2})\b/);
		if (yearMatch) {
			return parseInt(yearMatch[1], 10);
		}

		return null;
	}

	/**
	 * Filter a list of people, excluding those who should be hidden
	 */
	filterProtectedPeople<T extends PersonPrivacyData>(people: T[]): T[] {
		if (!this.settings.enablePrivacyProtection) {
			return people;
		}

		if (this.settings.privacyDisplayFormat !== 'hidden') {
			return people;
		}

		return people.filter(person => !this.isLikelyLiving(person));
	}

	/**
	 * Get a summary of privacy status for a list of people
	 */
	getPrivacySummary(people: PersonPrivacyData[]): {
		total: number;
		protected: number;
		excluded: number;
	} {
		let protectedCount = 0;
		let excludedCount = 0;

		for (const person of people) {
			const result = this.applyPrivacy(person);
			if (result.isProtected) {
				protectedCount++;
				if (result.excludeFromOutput) {
					excludedCount++;
				}
			}
		}

		return {
			total: people.length,
			protected: protectedCount,
			excluded: excludedCount
		};
	}
}

/**
 * Create a privacy service instance from plugin settings
 */
export function createPrivacyService(settings: {
	enablePrivacyProtection: boolean;
	livingPersonAgeThreshold: number;
	privacyDisplayFormat: 'living' | 'private' | 'initials' | 'hidden';
	hideDetailsForLiving: boolean;
}): PrivacyService {
	return new PrivacyService({
		enablePrivacyProtection: settings.enablePrivacyProtection,
		livingPersonAgeThreshold: settings.livingPersonAgeThreshold,
		privacyDisplayFormat: settings.privacyDisplayFormat,
		hideDetailsForLiving: settings.hideDetailsForLiving
	});
}

// ============================================================================
// Private Fields Utilities
// ============================================================================
// These utilities support user-defined private fields via the `private_fields`
// frontmatter property. Fields listed there are treated as private and can be
// excluded from exports.

/**
 * Check if a field name is marked as private by the user.
 */
export function isPrivateField(fieldName: string, privateFields: string[]): boolean {
	return privateFields.includes(fieldName);
}

/**
 * Get only the private field values from a frontmatter object.
 * Returns a new object containing only the fields listed in privateFields.
 */
export function getPrivateFieldValues(
	frontmatter: Record<string, unknown>,
	privateFields: string[]
): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(frontmatter).filter(([key]) => privateFields.includes(key))
	);
}

/**
 * Filter out private fields from a data object.
 * Returns a new object with private fields removed.
 */
export function filterPrivateFields<T extends Record<string, unknown>>(
	data: T,
	privateFields: string[]
): Partial<T> {
	return Object.fromEntries(
		Object.entries(data).filter(([key]) => !privateFields.includes(key))
	) as Partial<T>;
}

/**
 * Summary of private fields found across people for export warnings.
 */
export interface PrivateFieldSummary {
	/** The field name marked as private */
	fieldName: string;
	/** Number of people who have this field marked as private */
	peopleCount: number;
}

/**
 * Minimal interface for scanning private fields.
 * Compatible with PersonNode from family-graph.ts.
 */
export interface PersonWithPrivateFields {
	privateFields?: string[];
}

/**
 * Scan a list of people for private fields that would be included in export.
 * Returns a summary of which private fields exist and how many people have them.
 * Used to show a warning dialog before export.
 */
export function scanForPrivateFields(people: PersonWithPrivateFields[]): PrivateFieldSummary[] {
	const fieldCounts = new Map<string, number>();

	for (const person of people) {
		if (!person.privateFields?.length) continue;
		for (const field of person.privateFields) {
			fieldCounts.set(field, (fieldCounts.get(field) || 0) + 1);
		}
	}

	return Array.from(fieldCounts.entries())
		.map(([fieldName, peopleCount]) => ({ fieldName, peopleCount }))
		.sort((a, b) => b.peopleCount - a.peopleCount);
}
