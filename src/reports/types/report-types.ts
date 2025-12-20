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
	| 'gaps-report'
	| 'register-report'
	| 'pedigree-chart'
	| 'descendant-chart';

/**
 * Base options for all reports
 */
export interface ReportOptions {
	/** Output method */
	outputMethod: 'vault' | 'download' | 'pdf';
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
 * Options for Register Report (NGSQ-style descendant report)
 */
export interface RegisterReportOptions extends ReportOptions {
	/** CR ID of the root ancestor */
	rootPersonCrId: string;
	/** Maximum number of generations to include */
	maxGenerations: number;
	/** Include dates and places */
	includeDetails: boolean;
	/** Include spouse information */
	includeSpouses: boolean;
}

/**
 * Options for Pedigree Chart (ancestor tree)
 */
export interface PedigreeChartOptions extends ReportOptions {
	/** CR ID of the root person */
	rootPersonCrId: string;
	/** Maximum number of generations to include */
	maxGenerations: number;
	/** Include dates and places */
	includeDetails: boolean;
}

/**
 * Options for Descendant Chart
 */
export interface DescendantChartOptions extends ReportOptions {
	/** CR ID of the root ancestor */
	rootPersonCrId: string;
	/** Maximum number of generations to include */
	maxGenerations: number;
	/** Include dates and places */
	includeDetails: boolean;
	/** Include spouse information */
	includeSpouses: boolean;
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
 * Register Report entry with NGSQ numbering
 */
export interface RegisterEntry {
	/** NGSQ-style number (e.g., "1", "2", "3i", "3ii") */
	registerNumber: string;
	/** Person data */
	person: ReportPerson;
	/** Generation number (1 = root, 2 = children, etc.) */
	generation: number;
	/** Whether this person has descendants in the report */
	hasDescendants: boolean;
	/** Reference number for descendants (the number they are listed under) */
	descendantRef?: string;
	/** Spouses */
	spouses: ReportPerson[];
	/** Children (with their register numbers if they continue the line) */
	children: Array<{ person: ReportPerson; registerNumber?: string }>;
}

/**
 * Register Report result
 */
export interface RegisterReportResult extends ReportResult {
	/** Root ancestor */
	rootPerson: ReportPerson;
	/** All entries in register order */
	entries: RegisterEntry[];
}

/**
 * Pedigree Chart result
 */
export interface PedigreeChartResult extends ReportResult {
	/** Root person */
	rootPerson: ReportPerson;
	/** Ancestor lines as formatted tree text */
	treeContent: string;
}

/**
 * Descendant entry for chart
 */
export interface DescendantEntry {
	/** Person data */
	person: ReportPerson;
	/** Indentation level (0 = root) */
	level: number;
	/** Spouses (if included) */
	spouses: ReportPerson[];
}

/**
 * Descendant Chart result
 */
export interface DescendantChartResult extends ReportResult {
	/** Root ancestor */
	rootPerson: ReportPerson;
	/** All descendants in tree order */
	entries: DescendantEntry[];
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
	},
	'register-report': {
		type: 'register-report',
		name: 'Register report',
		description: 'Descendants with NGSQ-style genealogical numbering',
		icon: 'list-ordered',
		requiresPerson: true
	},
	'pedigree-chart': {
		type: 'pedigree-chart',
		name: 'Pedigree chart',
		description: 'Ancestor tree formatted as markdown',
		icon: 'git-branch',
		requiresPerson: true
	},
	'descendant-chart': {
		type: 'descendant-chart',
		name: 'Descendant chart',
		description: 'Descendant tree formatted as markdown',
		icon: 'git-fork',
		requiresPerson: true
	}
};
