/**
 * Sources Module - Evidence & Source Management
 *
 * Exports all source-related types and services.
 */

// Types
export type {
	SourceConfidence,
	CitationFormat,
	SourceTypeDefinition,
	SourceNote,
	SourceStats
} from './types/source-types';

export {
	BUILT_IN_SOURCE_TYPES,
	getSourceType,
	getAllSourceTypes,
	getSourceTypesByCategory,
	SOURCE_CATEGORY_NAMES
} from './types/source-types';

// Services
export { SourceService } from './services/source-service';
