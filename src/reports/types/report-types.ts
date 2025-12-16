/**
 * Report Types
 *
 * Type definitions for the Reports module.
 */

/**
 * Available report types
 */
export type ReportType =
	| 'family-group-sheet'
	| 'individual-summary'
	| 'ahnentafel'
	| 'gaps-report';

/**
 * Base options for all reports
 */
export interface ReportOptions {
	/** Output method */
	outputMethod: 'vault' | 'download';
	/** Output folder path (for vault output) */
	outputFolder?: string;
	/** Custom filename (without extension) */
	filename?: string;
	/** Include source citations */
	includeSources: boolean;
}

/**
 * Options for Family Group Sheet report
 */
export interface FamilyGroupSheetOptions extends ReportOptions {
	/** CR ID of the primary person */
	personCrId: string;
	/** Include children in the report */
	includeChildren: boolean;
	/** Include detailed spouse information */
	includeSpouseDetails: boolean;
	/** Include events (marriage, etc.) */
	includeEvents: boolean;
}

/**
 * Options for Individual Summary report
 */
export interface IndividualSummaryOptions extends ReportOptions {
	/** CR ID of the person */
	personCrId: string;
	/** Include life events */
	includeEvents: boolean;
	/** Include family relationships */
	includeFamily: boolean;
	/** Include occupation and other attributes */
	includeAttributes: boolean;
}

/**
 * Options for Ahnentafel report
 */
export interface AhnentafelOptions extends ReportOptions {
	/** CR ID of the root person */
	rootPersonCrId: string;
	/** Maximum number of generations to include */
	maxGenerations: number;
	/** Include dates and places */
	includeDetails: boolean;
}

/**
 * Options for Gaps Report
 */
export interface GapsReportOptions extends ReportOptions {
	/** Scope of the report */
	scope: 'all' | 'collection';
	/** Collection path (if scope is 'collection') */
	collectionPath?: string;
	/** Fields to check for missing data */
	fieldsToCheck: {
		birthDate: boolean;
		deathDate: boolean;
		parents: boolean;
		sources: boolean;
	};
	/** Maximum number of items per category */
	maxItemsPerCategory: number;
}

/**
 * Person data used in reports
 */
export interface ReportPerson {
	crId: string;
	name: string;
	birthDate?: string;
	birthPlace?: string;
	deathDate?: string;
	deathPlace?: string;
	sex?: 'male' | 'female' | 'other' | 'unknown';
	occupation?: string;
	filePath: string;
}

/**
 * Event data used in reports
 */
export interface ReportEvent {
	type: string;
	date?: string;
	place?: string;
	description?: string;
	sources: string[];
}

/**
 * Result of report generation
 */
export interface ReportResult {
	/** Whether generation succeeded */
	success: boolean;
	/** Generated markdown content */
	content: string;
	/** Suggested filename */
	suggestedFilename: string;
	/** Statistics about the report */
	stats: {
		/** Number of people included */
		peopleCount: number;
		/** Number of events included */
		eventsCount: number;
		/** Number of sources cited */
		sourcesCount: number;
		/** Number of generations (for Ahnentafel) */
		generationsCount?: number;
	};
	/** Error message if failed */
	error?: string;
	/** Warnings during generation */
	warnings: string[];
}

/**
 * Family Group Sheet result
 */
export interface FamilyGroupSheetResult extends ReportResult {
	/** Primary person */
	primaryPerson: ReportPerson;
	/** Spouse(s) */
	spouses: ReportPerson[];
	/** Children */
	children: ReportPerson[];
}

/**
 * Individual Summary result
 */
export interface IndividualSummaryResult extends ReportResult {
	/** The person */
	person: ReportPerson;
	/** Life events */
	events: ReportEvent[];
}

/**
 * Ahnentafel result
 */
export interface AhnentafelResult extends ReportResult {
	/** Root person */
	rootPerson: ReportPerson;
	/** Ancestors by Sosa-Stradonitz number */
	ancestors: Map<number, ReportPerson>;
}

/**
 * Gaps Report result
 */
export interface GapsReportResult extends ReportResult {
	/** Summary statistics */
	summary: {
		totalPeople: number;
		missingBirthDate: number;
		missingDeathDate: number;
		missingParents: number;
		unsourced: number;
	};
	/** People missing birth dates */
	missingBirthDates: ReportPerson[];
	/** People missing death dates (excluding living) */
	missingDeathDates: ReportPerson[];
	/** People missing parents */
	missingParents: ReportPerson[];
	/** People without source citations */
	unsourcedPeople: ReportPerson[];
}

/**
 * Report metadata for display
 */
export interface ReportMetadata {
	type: ReportType;
	name: string;
	description: string;
	icon: string;
	requiresPerson: boolean;
}

/**
 * All report metadata
 */
export const REPORT_METADATA: Record<ReportType, ReportMetadata> = {
	'family-group-sheet': {
		type: 'family-group-sheet',
		name: 'Family group sheet',
		description: 'Couple with spouse(s), children, vitals, and sources',
		icon: 'users',
		requiresPerson: true
	},
	'individual-summary': {
		type: 'individual-summary',
		name: 'Individual summary',
		description: 'All known facts for one person with source citations',
		icon: 'user',
		requiresPerson: true
	},
	'ahnentafel': {
		type: 'ahnentafel',
		name: 'Ahnentafel report',
		description: 'Numbered ancestor list with configurable depth',
		icon: 'git-branch',
		requiresPerson: true
	},
	'gaps-report': {
		type: 'gaps-report',
		name: 'Gaps report',
		description: 'Missing vital records and research opportunities',
		icon: 'search',
		requiresPerson: false
	}
};
