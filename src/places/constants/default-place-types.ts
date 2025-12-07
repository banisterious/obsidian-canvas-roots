/**
 * Default built-in place types for Canvas Roots
 *
 * These types cover common geographic and political divisions,
 * from global (planet) to local (buildings).
 */

import type { PlaceTypeDefinition, PlaceTypeCategoryDefinition } from '../types/place-types';
import { BUILT_IN_PLACE_TYPE_CATEGORIES } from '../types/place-types';

/**
 * Built-in place types with hierarchy levels
 *
 * Hierarchy levels determine valid parent-child relationships:
 * - A place can only have a parent with a LOWER hierarchy level
 * - e.g., a city (level 7) can have a county (5) or state (3) as parent
 *        but not another city (7) or a village (9)
 */
export const DEFAULT_PLACE_TYPES: PlaceTypeDefinition[] = [
	// Geographic (0-1)
	{
		id: 'planet',
		name: 'Planet',
		description: 'Celestial body (for sci-fi or mythological worlds)',
		hierarchyLevel: 0,
		category: 'geographic',
		builtIn: true
	},
	{
		id: 'continent',
		name: 'Continent',
		description: 'Major landmass',
		hierarchyLevel: 1,
		category: 'geographic',
		builtIn: true
	},

	// Political divisions (2-5)
	{
		id: 'country',
		name: 'Country',
		description: 'Sovereign nation or kingdom',
		hierarchyLevel: 2,
		category: 'political',
		builtIn: true
	},
	{
		id: 'state',
		name: 'State',
		description: 'First-level administrative division (US states, German Länder)',
		hierarchyLevel: 3,
		category: 'political',
		builtIn: true
	},
	{
		id: 'province',
		name: 'Province',
		description: 'First-level administrative division (Canadian provinces)',
		hierarchyLevel: 3,
		category: 'political',
		builtIn: true
	},
	{
		id: 'region',
		name: 'Region',
		description: 'Geographic or administrative region',
		hierarchyLevel: 4,
		category: 'political',
		builtIn: true
	},
	{
		id: 'county',
		name: 'County',
		description: 'Administrative subdivision (US counties, UK counties)',
		hierarchyLevel: 5,
		category: 'political',
		builtIn: true
	},

	// Settlements (6-9)
	{
		id: 'district',
		name: 'District',
		description: 'Urban district or borough',
		hierarchyLevel: 6,
		category: 'settlement',
		builtIn: true
	},
	{
		id: 'city',
		name: 'City',
		description: 'Large urban settlement',
		hierarchyLevel: 7,
		category: 'settlement',
		builtIn: true
	},
	{
		id: 'town',
		name: 'Town',
		description: 'Medium-sized settlement',
		hierarchyLevel: 8,
		category: 'settlement',
		builtIn: true
	},
	{
		id: 'village',
		name: 'Village',
		description: 'Small rural settlement',
		hierarchyLevel: 9,
		category: 'settlement',
		builtIn: true
	},

	// Subdivisions (10)
	{
		id: 'parish',
		name: 'Parish',
		description: 'Ecclesiastical or civil parish',
		hierarchyLevel: 10,
		category: 'subdivision',
		builtIn: true
	},

	// Structures (11-12)
	{
		id: 'estate',
		name: 'Estate',
		description: 'Large property or manor',
		hierarchyLevel: 11,
		category: 'structure',
		builtIn: true
	},
	{
		id: 'castle',
		name: 'Castle',
		description: 'Fortified residence',
		hierarchyLevel: 11,
		category: 'structure',
		builtIn: true
	},
	{
		id: 'church',
		name: 'Church',
		description: 'Religious building',
		hierarchyLevel: 12,
		category: 'structure',
		builtIn: true
	},
	{
		id: 'cemetery',
		name: 'Cemetery',
		description: 'Burial ground',
		hierarchyLevel: 12,
		category: 'structure',
		builtIn: true
	}
];

/**
 * Get a default place type by ID
 */
export function getDefaultPlaceType(id: string): PlaceTypeDefinition | undefined {
	return DEFAULT_PLACE_TYPES.find(t => t.id === id);
}

/**
 * Get all default place types at a specific hierarchy level
 */
export function getDefaultPlaceTypesByLevel(level: number): PlaceTypeDefinition[] {
	return DEFAULT_PLACE_TYPES.filter(t => t.hierarchyLevel === level);
}

/**
 * Check if a type ID is a built-in place type
 */
export function isBuiltInPlaceType(typeId: string): boolean {
	return DEFAULT_PLACE_TYPES.some(t => t.id === typeId);
}

/**
 * Get all place types (built-in + custom)
 */
export function getAllPlaceTypes(
	customTypes: PlaceTypeDefinition[] = [],
	showBuiltIn: boolean = true
): PlaceTypeDefinition[] {
	const types: PlaceTypeDefinition[] = [];

	if (showBuiltIn) {
		types.push(...DEFAULT_PLACE_TYPES);
	}

	types.push(...customTypes);

	// Sort by hierarchy level, then by name
	return types.sort((a, b) => {
		if (a.hierarchyLevel !== b.hierarchyLevel) {
			return a.hierarchyLevel - b.hierarchyLevel;
		}
		return a.name.localeCompare(b.name);
	});
}

/**
 * Get all place types with customizations applied
 */
export function getAllPlaceTypesWithCustomizations(
	customTypes: PlaceTypeDefinition[] = [],
	showBuiltIn: boolean = true,
	customizations: Record<string, Partial<PlaceTypeDefinition>> = {},
	hiddenTypes: string[] = []
): PlaceTypeDefinition[] {
	const types: PlaceTypeDefinition[] = [];

	// Add built-in types with customizations applied
	if (showBuiltIn) {
		for (const type of DEFAULT_PLACE_TYPES) {
			if (hiddenTypes.includes(type.id)) continue;

			const customization = customizations[type.id];
			if (customization) {
				types.push({
					...type,
					name: customization.name ?? type.name,
					description: customization.description ?? type.description,
					hierarchyLevel: customization.hierarchyLevel ?? type.hierarchyLevel,
					category: customization.category ?? type.category
				});
			} else {
				types.push(type);
			}
		}
	}

	// Add custom types (filter hidden)
	for (const type of customTypes) {
		if (!hiddenTypes.includes(type.id)) {
			types.push(type);
		}
	}

	// Sort by hierarchy level, then by name
	return types.sort((a, b) => {
		if (a.hierarchyLevel !== b.hierarchyLevel) {
			return a.hierarchyLevel - b.hierarchyLevel;
		}
		return a.name.localeCompare(b.name);
	});
}

/**
 * Get a place type by ID (checking custom types first, then built-in)
 */
export function getPlaceType(
	id: string,
	customTypes: PlaceTypeDefinition[] = [],
	customizations: Record<string, Partial<PlaceTypeDefinition>> = {}
): PlaceTypeDefinition | undefined {
	// Check custom types first
	const customType = customTypes.find(t => t.id === id);
	if (customType) {
		return customType;
	}

	// Check built-in types
	const builtIn = DEFAULT_PLACE_TYPES.find(t => t.id === id);
	if (builtIn) {
		const customization = customizations[id];
		if (customization) {
			return {
				...builtIn,
				name: customization.name ?? builtIn.name,
				description: customization.description ?? builtIn.description,
				hierarchyLevel: customization.hierarchyLevel ?? builtIn.hierarchyLevel
			};
		}
		return builtIn;
	}

	return undefined;
}

/**
 * Check if a type ID is valid (exists in built-in or custom types)
 */
export function isValidPlaceType(
	id: string,
	customTypes: PlaceTypeDefinition[] = []
): boolean {
	return DEFAULT_PLACE_TYPES.some(t => t.id === id) ||
		customTypes.some(t => t.id === id);
}

/**
 * Get the hierarchy level for a place type
 */
export function getPlaceTypeHierarchyLevel(
	typeId: string,
	customTypes: PlaceTypeDefinition[] = [],
	customizations: Record<string, Partial<PlaceTypeDefinition>> = {}
): number {
	const type = getPlaceType(typeId, customTypes, customizations);
	return type?.hierarchyLevel ?? 99; // Unknown types get level 99 (can be child of anything)
}

/**
 * Check if a place type can be a parent of another type
 * (parent must have a lower hierarchy level)
 */
export function canBeParentOf(
	parentTypeId: string,
	childTypeId: string,
	customTypes: PlaceTypeDefinition[] = [],
	customizations: Record<string, Partial<PlaceTypeDefinition>> = {}
): boolean {
	const parentLevel = getPlaceTypeHierarchyLevel(parentTypeId, customTypes, customizations);
	const childLevel = getPlaceTypeHierarchyLevel(childTypeId, customTypes, customizations);
	return parentLevel < childLevel;
}

/**
 * Get place types grouped by category
 */
export function getPlaceTypesByCategory(
	customTypes: PlaceTypeDefinition[] = [],
	showBuiltIn: boolean = true,
	customizations: Record<string, Partial<PlaceTypeDefinition>> = {},
	hiddenTypes: string[] = [],
	customCategories: PlaceTypeCategoryDefinition[] = [],
	categoryCustomizations: Record<string, Partial<PlaceTypeCategoryDefinition>> = {},
	hiddenCategories: string[] = []
): Map<PlaceTypeCategoryDefinition, PlaceTypeDefinition[]> {
	const types = getAllPlaceTypesWithCustomizations(
		customTypes, showBuiltIn, customizations, hiddenTypes
	);

	const categories = getAllPlaceTypeCategories(
		customCategories, categoryCustomizations, hiddenCategories
	);

	const result = new Map<PlaceTypeCategoryDefinition, PlaceTypeDefinition[]>();

	for (const category of categories) {
		// Use explicit category field on types
		const categoryTypes = types.filter(t => t.category === category.id);

		if (categoryTypes.length > 0) {
			result.set(category, categoryTypes);
		}
	}

	return result;
}

/**
 * Check if a category ID is a built-in place type category
 */
export function isBuiltInPlaceTypeCategory(categoryId: string): boolean {
	return BUILT_IN_PLACE_TYPE_CATEGORIES.some(c => c.id === categoryId);
}

/**
 * Get all place type categories (built-in + custom, with customizations applied)
 */
export function getAllPlaceTypeCategories(
	customCategories: PlaceTypeCategoryDefinition[] = [],
	customizations: Record<string, Partial<PlaceTypeCategoryDefinition>> = {},
	hiddenCategories: string[] = []
): PlaceTypeCategoryDefinition[] {
	const categories: PlaceTypeCategoryDefinition[] = [];

	// Add built-in categories with customizations applied
	for (const cat of BUILT_IN_PLACE_TYPE_CATEGORIES) {
		if (hiddenCategories.includes(cat.id)) continue;

		const customization = customizations[cat.id];
		if (customization) {
			categories.push({
				...cat,
				name: customization.name ?? cat.name,
				sortOrder: customization.sortOrder ?? cat.sortOrder
			});
		} else {
			categories.push(cat);
		}
	}

	// Add custom categories (filter hidden)
	for (const cat of customCategories) {
		if (!hiddenCategories.includes(cat.id)) {
			categories.push(cat);
		}
	}

	// Sort by sortOrder
	return categories.sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Get hierarchy level range for a category
 */
export function getCategoryHierarchyLevelRange(categoryId: string): { min: number; max: number } {
	switch (categoryId) {
		case 'geographic': return { min: 0, max: 1 };
		case 'political': return { min: 2, max: 5 };
		case 'settlement': return { min: 6, max: 9 };
		case 'subdivision': return { min: 10, max: 10 };
		case 'structure': return { min: 11, max: 99 };
		default: return { min: 0, max: 99 };
	}
}

/**
 * Get the category for a hierarchy level
 */
export function getCategoryForHierarchyLevel(level: number): string {
	if (level <= 1) return 'geographic';
	if (level <= 5) return 'political';
	if (level <= 9) return 'settlement';
	if (level <= 10) return 'subdivision';
	return 'structure';
}
