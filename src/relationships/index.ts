/**
 * Relationships module for Charted Roots
 *
 * Provides custom relationship type management, parsing, and visualization.
 */

// Types
export type {
	RelationshipCategory,
	RelationshipCategoryDefinition,
	RelationshipLineStyle,
	RelationshipTypeDefinition,
	RawRelationship,
	ParsedRelationship,
	RelationshipStats,
	RelationshipValidationResult
} from './types/relationship-types';

export {
	RELATIONSHIP_CATEGORY_NAMES,
	extractWikilinkName,
	extractWikilinkPath,
	isWikilink
} from './types/relationship-types';

// Constants
export {
	DEFAULT_RELATIONSHIP_TYPES,
	BUILT_IN_RELATIONSHIP_CATEGORIES,
	getDefaultRelationshipType,
	getDefaultRelationshipTypesByCategory,
	getAllRelationshipCategories,
	getRelationshipCategoryName,
	getAllRelationshipTypes,
	getAllRelationshipTypesWithCustomizations,
	getRelationshipType,
	isBuiltInRelationshipCategory,
	isValidRelationshipType,
	getRelationshipTypesByCategoryWithCustomizations
} from './constants/default-relationship-types';

// Services
export { RelationshipService } from './services/relationship-service';

// UI Components
export { renderRelationshipsTab } from './ui/relationships-tab';
export { RelationshipTypeEditorModal } from './ui/relationship-type-editor-modal';
