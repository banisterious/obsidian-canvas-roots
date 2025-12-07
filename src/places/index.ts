/**
 * Places module for Canvas Roots
 *
 * Provides place type management, hierarchy, and geographic features.
 */

// Types
export type {
	PlaceTypeDefinition,
	BuiltInPlaceTypeCategory,
	PlaceTypeCategoryDefinition
} from './types/place-types';

export {
	PLACE_TYPE_CATEGORY_NAMES,
	BUILT_IN_PLACE_TYPE_CATEGORIES,
	getPlaceTypeCategory
} from './types/place-types';

// Constants
export {
	DEFAULT_PLACE_TYPES,
	getDefaultPlaceType,
	getDefaultPlaceTypesByLevel,
	isBuiltInPlaceType,
	getAllPlaceTypes,
	getAllPlaceTypesWithCustomizations,
	getPlaceType,
	isValidPlaceType,
	getPlaceTypeHierarchyLevel,
	canBeParentOf,
	getPlaceTypesByCategory,
	isBuiltInPlaceTypeCategory,
	getAllPlaceTypeCategories,
	getCategoryHierarchyLevelRange,
	getCategoryForHierarchyLevel
} from './constants/default-place-types';
