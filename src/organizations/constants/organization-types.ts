/**
 * Organization Types - Built-in Definitions
 *
 * Default organization type categories with colors and icons.
 */

import type { OrganizationType, OrganizationTypeDefinition, OrganizationCategoryDefinition } from '../types/organization-types';

/**
 * Built-in organization type categories
 */
export const BUILT_IN_ORGANIZATION_CATEGORIES: OrganizationCategoryDefinition[] = [
	{ id: 'governance', name: 'Governance & nobility', sortOrder: 0 },
	{ id: 'economic', name: 'Economic & trade', sortOrder: 1 },
	{ id: 'military_religious', name: 'Military & religious', sortOrder: 2 },
	{ id: 'social', name: 'Social & educational', sortOrder: 3 },
	{ id: 'other', name: 'Other', sortOrder: 4 }
];

/**
 * All built-in organization types
 */
export const BUILT_IN_ORGANIZATION_TYPES: OrganizationTypeDefinition[] = [
	// Governance & Nobility
	{
		id: 'noble_house',
		name: 'Noble house',
		description: 'Feudal houses, dynasties, aristocratic families',
		color: '#9b59b6',
		icon: 'crown',
		category: 'governance',
		isBuiltIn: true
	},
	{
		id: 'political',
		name: 'Political entity',
		description: 'Kingdoms, republics, political parties',
		color: '#27ae60',
		icon: 'landmark',
		category: 'governance',
		isBuiltIn: true
	},

	// Economic & Trade
	{
		id: 'guild',
		name: 'Guild',
		description: 'Trade guilds, craftsmen organizations',
		color: '#e67e22',
		icon: 'hammer',
		category: 'economic',
		isBuiltIn: true
	},
	{
		id: 'corporation',
		name: 'Corporation',
		description: 'Modern companies, businesses',
		color: '#3498db',
		icon: 'building-2',
		category: 'economic',
		isBuiltIn: true
	},

	// Military & Religious
	{
		id: 'military',
		name: 'Military unit',
		description: 'Armies, regiments, navies, military orders',
		color: '#e74c3c',
		icon: 'shield',
		category: 'military_religious',
		isBuiltIn: true
	},
	{
		id: 'religious',
		name: 'Religious order',
		description: 'Churches, monasteries, religious orders',
		color: '#f1c40f',
		icon: 'church',
		category: 'military_religious',
		isBuiltIn: true
	},

	// Social & Educational
	{
		id: 'educational',
		name: 'Educational',
		description: 'Schools, universities, academies',
		color: '#1abc9c',
		icon: 'graduation-cap',
		category: 'social',
		isBuiltIn: true
	},

	// Other
	{
		id: 'custom',
		name: 'Other',
		description: 'User-defined organization type',
		color: '#95a5a6',
		icon: 'folder',
		category: 'other',
		isBuiltIn: true
	}
];

/**
 * Legacy: Keep DEFAULT_ORGANIZATION_TYPES as alias for backwards compatibility
 */
export const DEFAULT_ORGANIZATION_TYPES = BUILT_IN_ORGANIZATION_TYPES;

/**
 * Check if a category ID is a built-in category
 */
export function isBuiltInOrganizationCategory(categoryId: string): boolean {
	return BUILT_IN_ORGANIZATION_CATEGORIES.some(c => c.id === categoryId);
}

/**
 * Get all organization type categories (built-in + custom)
 * Supports customizations and hiding of built-in categories
 */
export function getAllOrganizationCategories(
	customCategories: OrganizationCategoryDefinition[] = [],
	customizations?: Record<string, Partial<OrganizationCategoryDefinition>>,
	hiddenCategories?: string[]
): OrganizationCategoryDefinition[] {
	const hidden = new Set(hiddenCategories ?? []);
	const categories: OrganizationCategoryDefinition[] = [];

	// Add built-in categories (with customizations, excluding hidden)
	for (const builtIn of BUILT_IN_ORGANIZATION_CATEGORIES) {
		if (hidden.has(builtIn.id)) continue;

		const overrides = customizations?.[builtIn.id];
		if (overrides) {
			categories.push({
				...builtIn,
				...overrides
			});
		} else {
			categories.push(builtIn);
		}
	}

	// Add custom categories, avoiding duplicate IDs
	const existingIds = new Set(categories.map(c => c.id));
	for (const custom of customCategories) {
		if (!existingIds.has(custom.id)) {
			categories.push(custom);
		}
	}

	// Sort by sortOrder
	return categories.sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Get organization category display name
 * Respects customizations for built-in categories
 */
export function getOrganizationCategoryName(
	categoryId: string,
	customCategories: OrganizationCategoryDefinition[] = [],
	customizations?: Record<string, Partial<OrganizationCategoryDefinition>>
): string {
	// Check customizations first for built-in categories
	const customization = customizations?.[categoryId];
	if (customization?.name) return customization.name;

	const builtIn = BUILT_IN_ORGANIZATION_CATEGORIES.find(c => c.id === categoryId);
	if (builtIn) return builtIn.name;

	const custom = customCategories.find(c => c.id === categoryId);
	if (custom) return custom.name;

	// Fallback: capitalize the ID
	return categoryId.charAt(0).toUpperCase() + categoryId.slice(1).replace(/_/g, ' ');
}

/**
 * Get all organization types with customizations and filtering applied
 */
export function getAllOrganizationTypesWithCustomizations(
	customTypes: OrganizationTypeDefinition[] = [],
	showBuiltIn = true,
	customizations?: Record<string, Partial<OrganizationTypeDefinition>>,
	hiddenTypes?: string[]
): OrganizationTypeDefinition[] {
	const hidden = new Set(hiddenTypes ?? []);
	const types: OrganizationTypeDefinition[] = [];

	// Add built-in types with customizations
	if (showBuiltIn) {
		for (const builtIn of BUILT_IN_ORGANIZATION_TYPES) {
			if (hidden.has(builtIn.id)) continue;

			const overrides = customizations?.[builtIn.id];
			if (overrides) {
				types.push({
					...builtIn,
					...overrides
				});
			} else {
				types.push(builtIn);
			}
		}
	}

	// Add custom types (excluding hidden)
	for (const custom of customTypes) {
		if (!hidden.has(custom.id)) {
			types.push(custom);
		}
	}

	return types;
}

/**
 * Group organization types by category with full customization support
 */
export function getOrganizationTypesByCategoryWithCustomizations(
	customTypes: OrganizationTypeDefinition[] = [],
	showBuiltIn = true,
	typeCustomizations?: Record<string, Partial<OrganizationTypeDefinition>>,
	hiddenTypes?: string[],
	customCategories: OrganizationCategoryDefinition[] = [],
	categoryCustomizations?: Record<string, Partial<OrganizationCategoryDefinition>>,
	hiddenCategories?: string[]
): Record<string, OrganizationTypeDefinition[]> {
	const types = getAllOrganizationTypesWithCustomizations(customTypes, showBuiltIn, typeCustomizations, hiddenTypes);
	const allCategories = getAllOrganizationCategories(customCategories, categoryCustomizations, hiddenCategories);

	// Initialize grouped object with all categories
	const grouped: Record<string, OrganizationTypeDefinition[]> = {};
	for (const cat of allCategories) {
		grouped[cat.id] = [];
	}

	// Group types into their categories
	for (const type of types) {
		if (grouped[type.category]) {
			grouped[type.category].push(type);
		} else {
			// Type's category not in list (possibly hidden), add to 'other'
			if (grouped['other']) {
				grouped['other'].push(type);
			}
		}
	}

	return grouped;
}

/**
 * Get organization type definition by ID
 */
export function getOrganizationType(
	typeId: string,
	customTypes: OrganizationTypeDefinition[] = [],
	customizations?: Record<string, Partial<OrganizationTypeDefinition>>
): OrganizationTypeDefinition {
	// Check custom types first
	const customType = customTypes.find(t => t.id === typeId);
	if (customType) return customType;

	// Check built-in types with customizations
	const builtIn = BUILT_IN_ORGANIZATION_TYPES.find(t => t.id === typeId);
	if (builtIn) {
		const overrides = customizations?.[typeId];
		if (overrides) {
			return { ...builtIn, ...overrides };
		}
		return builtIn;
	}

	// Fallback to custom/other type
	return BUILT_IN_ORGANIZATION_TYPES.find(t => t.id === 'custom')!;
}

/**
 * Get all organization types (built-in + custom from settings)
 */
export function getAllOrganizationTypes(
	customTypes: OrganizationTypeDefinition[] = []
): OrganizationTypeDefinition[] {
	return [...BUILT_IN_ORGANIZATION_TYPES, ...customTypes.filter(t => !t.isBuiltIn)];
}

/**
 * Check if a string is a valid organization type ID
 */
export function isValidOrganizationType(typeId: string): typeId is OrganizationType {
	return BUILT_IN_ORGANIZATION_TYPES.some(t => t.id === typeId);
}
