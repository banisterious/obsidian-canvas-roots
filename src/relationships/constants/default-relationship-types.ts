/**
 * Default built-in relationship types for Canvas Roots
 *
 * These types cover common real-world genealogical relationships
 * as well as world-building scenarios for fiction writers.
 */

import type { RelationshipTypeDefinition, RelationshipCategoryDefinition } from '../types/relationship-types';

/**
 * Built-in relationship categories
 */
export const BUILT_IN_RELATIONSHIP_CATEGORIES: RelationshipCategoryDefinition[] = [
	{ id: 'family', name: 'Family', sortOrder: 0 },
	{ id: 'legal', name: 'Legal/Guardianship', sortOrder: 1 },
	{ id: 'religious', name: 'Religious/Spiritual', sortOrder: 2 },
	{ id: 'professional', name: 'Professional', sortOrder: 3 },
	{ id: 'social', name: 'Social', sortOrder: 4 },
	{ id: 'feudal', name: 'Feudal/World-building', sortOrder: 5 }
];

/**
 * Built-in relationship types
 *
 * Color palette uses Tailwind CSS colors for consistency:
 * - Green (#22c55e) - Family (parent/child)
 * - Purple (#a855f7) - Family (spouse)
 * - Lime (#84cc16) - Family (sibling)
 * - Teal (#14b8a6) - Legal/Guardianship
 * - Cyan (#06b6d4) - Adoption
 * - Sky (#0ea5e9) - Foster
 * - Blue (#3b82f6) - Religious (godparent)
 * - Violet (#8b5cf6) - Religious (mentor)
 * - Orange (#f97316) - Professional
 * - Gray (#6b7280, #9ca3af) - Social (witness, neighbor)
 * - Pink (#ec4899) - Social (betrothed)
 * - Yellow/Gold (#eab308) - Feudal
 * - Emerald (#10b981) - Ally
 * - Red (#ef4444) - Rival
 */
export const DEFAULT_RELATIONSHIP_TYPES: RelationshipTypeDefinition[] = [
	// Family (core genealogical relationships)
	{
		id: 'spouse',
		name: 'Spouse',
		category: 'family',
		color: '#a855f7',
		lineStyle: 'solid',
		symmetric: true,
		builtIn: true
	},
	{
		id: 'parent',
		name: 'Parent',
		category: 'family',
		color: '#22c55e',
		lineStyle: 'solid',
		inverse: 'child',
		symmetric: false,
		builtIn: true
	},
	{
		id: 'child',
		name: 'Child',
		category: 'family',
		color: '#22c55e',
		lineStyle: 'solid',
		inverse: 'parent',
		symmetric: false,
		builtIn: true
	},
	{
		id: 'sibling',
		name: 'Sibling',
		category: 'family',
		color: '#84cc16',
		lineStyle: 'solid',
		symmetric: true,
		builtIn: true
	},

	// Legal/Guardianship
	{
		id: 'guardian',
		name: 'Guardian',
		category: 'legal',
		color: '#14b8a6',
		lineStyle: 'solid',
		inverse: 'ward',
		symmetric: false,
		builtIn: true
	},
	{
		id: 'ward',
		name: 'Ward',
		category: 'legal',
		color: '#14b8a6',
		lineStyle: 'solid',
		inverse: 'guardian',
		symmetric: false,
		builtIn: true
	},
	{
		id: 'step_parent',
		name: 'Step-parent',
		category: 'legal',
		color: '#14b8a6',
		lineStyle: 'dashed',
		inverse: 'step_child',
		symmetric: false,
		builtIn: true
	},
	{
		id: 'step_child',
		name: 'Step-child',
		category: 'legal',
		color: '#14b8a6',
		lineStyle: 'dashed',
		inverse: 'step_parent',
		symmetric: false,
		builtIn: true
	},
	{
		id: 'adoptive_parent',
		name: 'Adoptive parent',
		category: 'legal',
		color: '#06b6d4',
		lineStyle: 'dotted',
		inverse: 'adopted_child',
		symmetric: false,
		builtIn: true
	},
	{
		id: 'adopted_child',
		name: 'Adopted child',
		category: 'legal',
		color: '#06b6d4',
		lineStyle: 'dotted',
		inverse: 'adoptive_parent',
		symmetric: false,
		builtIn: true
	},
	{
		id: 'foster_parent',
		name: 'Foster parent',
		category: 'legal',
		color: '#0ea5e9',
		lineStyle: 'solid',
		inverse: 'foster_child',
		symmetric: false,
		builtIn: true
	},
	{
		id: 'foster_child',
		name: 'Foster child',
		category: 'legal',
		color: '#0ea5e9',
		lineStyle: 'solid',
		inverse: 'foster_parent',
		symmetric: false,
		builtIn: true
	},

	// Religious/Spiritual
	{
		id: 'godparent',
		name: 'Godparent',
		category: 'religious',
		color: '#3b82f6',
		lineStyle: 'solid',
		inverse: 'godchild',
		symmetric: false,
		builtIn: true
	},
	{
		id: 'godchild',
		name: 'Godchild',
		category: 'religious',
		color: '#3b82f6',
		lineStyle: 'solid',
		inverse: 'godparent',
		symmetric: false,
		builtIn: true
	},
	{
		id: 'mentor',
		name: 'Mentor',
		category: 'religious',
		color: '#8b5cf6',
		lineStyle: 'solid',
		inverse: 'disciple',
		symmetric: false,
		builtIn: true
	},
	{
		id: 'disciple',
		name: 'Disciple',
		category: 'religious',
		color: '#8b5cf6',
		lineStyle: 'solid',
		inverse: 'mentor',
		symmetric: false,
		builtIn: true
	},

	// Professional
	{
		id: 'master',
		name: 'Master',
		category: 'professional',
		color: '#f97316',
		lineStyle: 'solid',
		inverse: 'apprentice',
		symmetric: false,
		builtIn: true
	},
	{
		id: 'apprentice',
		name: 'Apprentice',
		category: 'professional',
		color: '#f97316',
		lineStyle: 'solid',
		inverse: 'master',
		symmetric: false,
		builtIn: true
	},
	{
		id: 'employer',
		name: 'Employer',
		category: 'professional',
		color: '#ea580c',
		lineStyle: 'solid',
		inverse: 'employee',
		symmetric: false,
		builtIn: true
	},
	{
		id: 'employee',
		name: 'Employee',
		category: 'professional',
		color: '#ea580c',
		lineStyle: 'solid',
		inverse: 'employer',
		symmetric: false,
		builtIn: true
	},

	// Social
	{
		id: 'witness',
		name: 'Witness',
		category: 'social',
		color: '#6b7280',
		lineStyle: 'dashed',
		symmetric: false,
		builtIn: true
	},
	{
		id: 'neighbor',
		name: 'Neighbor',
		category: 'social',
		color: '#9ca3af',
		lineStyle: 'dashed',
		symmetric: true,
		builtIn: true
	},
	{
		id: 'companion',
		name: 'Companion',
		category: 'social',
		color: '#22c55e',
		lineStyle: 'solid',
		symmetric: true,
		builtIn: true
	},
	{
		id: 'betrothed',
		name: 'Betrothed',
		category: 'social',
		color: '#ec4899',
		lineStyle: 'dashed',
		symmetric: true,
		builtIn: true
	},

	// Feudal/World-building
	{
		id: 'liege',
		name: 'Liege lord',
		category: 'feudal',
		color: '#eab308',
		lineStyle: 'solid',
		inverse: 'vassal',
		symmetric: false,
		builtIn: true
	},
	{
		id: 'vassal',
		name: 'Vassal',
		category: 'feudal',
		color: '#eab308',
		lineStyle: 'solid',
		inverse: 'liege',
		symmetric: false,
		builtIn: true
	},
	{
		id: 'ally',
		name: 'Ally',
		category: 'feudal',
		color: '#10b981',
		lineStyle: 'dashed',
		symmetric: true,
		builtIn: true
	},
	{
		id: 'rival',
		name: 'Rival',
		category: 'feudal',
		color: '#ef4444',
		lineStyle: 'dashed',
		symmetric: true,
		builtIn: true
	}
];

/**
 * Get a default relationship type by ID
 */
export function getDefaultRelationshipType(id: string): RelationshipTypeDefinition | undefined {
	return DEFAULT_RELATIONSHIP_TYPES.find(t => t.id === id);
}

/**
 * Get all default relationship types for a category
 */
export function getDefaultRelationshipTypesByCategory(category: string): RelationshipTypeDefinition[] {
	return DEFAULT_RELATIONSHIP_TYPES.filter(t => t.category === category);
}

/**
 * Check if a category ID is a built-in category
 */
export function isBuiltInRelationshipCategory(categoryId: string): boolean {
	return BUILT_IN_RELATIONSHIP_CATEGORIES.some(c => c.id === categoryId);
}

/**
 * Get all relationship categories (built-in + custom, with customizations and hiding applied)
 */
export function getAllRelationshipCategories(
	customCategories: RelationshipCategoryDefinition[] = [],
	customizations: Record<string, Partial<RelationshipCategoryDefinition>> = {},
	hiddenCategories: string[] = []
): RelationshipCategoryDefinition[] {
	// Start with built-in categories (apply customizations)
	const builtIn = BUILT_IN_RELATIONSHIP_CATEGORIES
		.filter(cat => !hiddenCategories.includes(cat.id))
		.map(cat => {
			const custom = customizations[cat.id];
			if (custom) {
				return {
					...cat,
					name: custom.name ?? cat.name
				};
			}
			return cat;
		});

	// Add custom categories
	const all = [...builtIn, ...customCategories];

	// Sort by sortOrder
	return all.sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Get the display name for a category (with customization support)
 */
export function getRelationshipCategoryName(
	categoryId: string,
	customCategories: RelationshipCategoryDefinition[] = [],
	customizations: Record<string, Partial<RelationshipCategoryDefinition>> = {}
): string {
	// Check customizations first
	const customization = customizations[categoryId];
	if (customization?.name) {
		return customization.name;
	}

	// Check built-in categories
	const builtIn = BUILT_IN_RELATIONSHIP_CATEGORIES.find(c => c.id === categoryId);
	if (builtIn) {
		return builtIn.name;
	}

	// Check custom categories
	const custom = customCategories.find(c => c.id === categoryId);
	if (custom) {
		return custom.name;
	}

	// Fall back to ID
	return categoryId;
}

/**
 * Get all relationship types (built-in + custom, with customizations applied)
 */
export function getAllRelationshipTypes(
	customTypes: RelationshipTypeDefinition[] = [],
	showBuiltIn: boolean = true
): RelationshipTypeDefinition[] {
	const types: RelationshipTypeDefinition[] = [];

	if (showBuiltIn) {
		types.push(...DEFAULT_RELATIONSHIP_TYPES);
	}

	types.push(...customTypes);

	return types;
}

/**
 * Get all relationship types with customizations applied
 */
export function getAllRelationshipTypesWithCustomizations(
	customTypes: RelationshipTypeDefinition[] = [],
	showBuiltIn: boolean = true,
	customizations: Record<string, Partial<RelationshipTypeDefinition>> = {},
	hiddenTypes: string[] = []
): RelationshipTypeDefinition[] {
	const types: RelationshipTypeDefinition[] = [];

	// Add built-in types with customizations applied
	if (showBuiltIn) {
		for (const type of DEFAULT_RELATIONSHIP_TYPES) {
			if (hiddenTypes.includes(type.id)) continue;

			const customization = customizations[type.id];
			if (customization) {
				types.push({
					...type,
					name: customization.name ?? type.name,
					description: customization.description ?? type.description,
					color: customization.color ?? type.color,
					lineStyle: customization.lineStyle ?? type.lineStyle
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

	return types;
}

/**
 * Get a relationship type by ID (checking custom types first, then built-in)
 */
export function getRelationshipType(
	id: string,
	customTypes: RelationshipTypeDefinition[] = [],
	customizations: Record<string, Partial<RelationshipTypeDefinition>> = {}
): RelationshipTypeDefinition | undefined {
	// Check custom types first
	const customType = customTypes.find(t => t.id === id);
	if (customType) {
		return customType;
	}

	// Check built-in types
	const builtIn = DEFAULT_RELATIONSHIP_TYPES.find(t => t.id === id);
	if (builtIn) {
		const customization = customizations[id];
		if (customization) {
			return {
				...builtIn,
				name: customization.name ?? builtIn.name,
				description: customization.description ?? builtIn.description,
				color: customization.color ?? builtIn.color,
				lineStyle: customization.lineStyle ?? builtIn.lineStyle
			};
		}
		return builtIn;
	}

	return undefined;
}

/**
 * Check if a type ID is valid (exists in built-in or custom types)
 */
export function isValidRelationshipType(
	id: string,
	customTypes: RelationshipTypeDefinition[] = []
): boolean {
	return DEFAULT_RELATIONSHIP_TYPES.some(t => t.id === id) ||
		customTypes.some(t => t.id === id);
}

/**
 * Get relationship types grouped by category with customizations applied
 */
export function getRelationshipTypesByCategoryWithCustomizations(
	customTypes: RelationshipTypeDefinition[] = [],
	showBuiltIn: boolean = true,
	customizations: Record<string, Partial<RelationshipTypeDefinition>> = {},
	hiddenTypes: string[] = [],
	customCategories: RelationshipCategoryDefinition[] = [],
	categoryCustomizations: Record<string, Partial<RelationshipCategoryDefinition>> = {},
	hiddenCategories: string[] = []
): Map<RelationshipCategoryDefinition, RelationshipTypeDefinition[]> {
	const types = getAllRelationshipTypesWithCustomizations(
		customTypes, showBuiltIn, customizations, hiddenTypes
	);

	const categories = getAllRelationshipCategories(
		customCategories, categoryCustomizations, hiddenCategories
	);

	const result = new Map<RelationshipCategoryDefinition, RelationshipTypeDefinition[]>();

	for (const category of categories) {
		const categoryTypes = types.filter(t => t.category === category.id);
		if (categoryTypes.length > 0) {
			result.set(category, categoryTypes);
		}
	}

	return result;
}
