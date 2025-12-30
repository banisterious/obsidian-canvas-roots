/**
 * Sources Module - Evidence & Source Management
 *
 * Exports all source-related types and services.
 */

// Types
export type {
	SourceConfidence,
	SourceQuality,
	CitationFormat,
	SourceTypeDefinition,
	SourceNote,
	SourceStats,
	FactKey,
	FactSourceEntry,
	SourcedFacts,
	FactCoverageStatus,
	FactCoverage,
	PersonResearchCoverage
} from './types/source-types';

export type {
	ProofStatus,
	ProofConfidence,
	ProofEvidence,
	ProofSummaryFrontmatter,
	ProofSummaryNote,
	PersonProofSummary,
	SourceConflict
} from './types/proof-types';

export {
	PROOF_STATUS_LABELS,
	PROOF_CONFIDENCE_LABELS,
	EVIDENCE_SUPPORT_LABELS,
	createEmptyProofSummary
} from './types/proof-types';

export {
	BUILT_IN_SOURCE_TYPES,
	FACT_KEYS,
	FACT_KEY_LABELS,
	FACT_KEY_TO_SOURCED_PROPERTY,
	DEFAULT_SOURCE_QUALITY,
	SOURCE_QUALITY_LABELS,
	getSourceType,
	getSourceQuality,
	getDefaultSourceQuality,
	getAllSourceTypes,
	getSourceTypesByCategory,
	SOURCE_CATEGORY_NAMES
} from './types/source-types';

export {
	SOURCE_TEMPLATES,
	DEFAULT_SOURCE_TEMPLATE,
	getSourceTemplate,
	applyTemplatePlaceholders
} from './types/source-templates';

// Services
export { SourceService } from './services/source-service';
export { EvidenceService, type ResearchGapsSummary } from './services/evidence-service';
export { ProofSummaryService } from './services/proof-summary-service';
export { SourcedFactsMigrationService, type LegacySourcedFactsNote } from './services/sourced-facts-migration-service';
export {
	generateCitation,
	generateAllCitations,
	getCitationFormats,
	copyCitationToClipboard,
	type Citation
} from './services/citation-service';

// UI Components
export { renderSourcesTab } from './ui/sources-tab';
export { CreateSourceModal } from './ui/create-source-modal';
export type { SourceModalOptions } from './ui/create-source-modal';
export { SourcePickerModal } from './ui/source-picker-modal';
export { CustomSourceTypeModal } from './ui/custom-source-type-modal';
export { renderMediaGallery } from './ui/media-gallery';
export { CitationGeneratorModal, renderCitationWidget, renderCitationPreview } from './ui/citation-generator';
export { CreateProofModal } from './ui/create-proof-modal';
export type { ProofModalOptions } from './ui/create-proof-modal';
