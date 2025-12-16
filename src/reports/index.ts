/**
 * Reports Module
 *
 * Provides genealogy report generation functionality.
 */

// Types
export type {
	ReportType,
	ReportOptions,
	FamilyGroupSheetOptions,
	IndividualSummaryOptions,
	AhnentafelOptions,
	GapsReportOptions,
	ReportPerson,
	ReportEvent,
	ReportResult,
	FamilyGroupSheetResult,
	IndividualSummaryResult,
	AhnentafelResult,
	GapsReportResult,
	ReportMetadata
} from './types/report-types';

export { REPORT_METADATA } from './types/report-types';

// Services
export {
	ReportGenerationService,
	createReportGenerationService
} from './services/report-generation-service';

export { FamilyGroupSheetGenerator } from './services/family-group-sheet-generator';
export { IndividualSummaryGenerator } from './services/individual-summary-generator';
export { AhnentafelGenerator } from './services/ahnentafel-generator';
export { GapsReportGenerator } from './services/gaps-report-generator';

// UI Components
export { ReportGeneratorModal } from './ui/report-generator-modal';
export type { ReportGeneratorModalOptions } from './ui/report-generator-modal';
