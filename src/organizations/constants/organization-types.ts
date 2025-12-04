/**
 * Organization Types - Built-in Definitions
 *
 * Default organization type categories with colors and icons.
 */

import type { OrganizationType, OrganizationTypeDefinition } from '../types/organization-types';

/**
 * Noble House - Feudal houses, dynasties, aristocratic families
 */
export const NOBLE_HOUSE: OrganizationTypeDefinition = {
	id: 'noble_house',
	name: 'Noble house',
	color: '#9b59b6', // Purple
	icon: 'crown',
	builtIn: true
};

/**
 * Guild - Trade guilds, craftsmen organizations
 */
export const GUILD: OrganizationTypeDefinition = {
	id: 'guild',
	name: 'Guild',
	color: '#e67e22', // Orange
	icon: 'hammer',
	builtIn: true
};

/**
 * Corporation - Modern companies, businesses
 */
export const CORPORATION: OrganizationTypeDefinition = {
	id: 'corporation',
	name: 'Corporation',
	color: '#3498db', // Blue
	icon: 'building-2',
	builtIn: true
};

/**
 * Military - Armies, regiments, navies, military orders
 */
export const MILITARY: OrganizationTypeDefinition = {
	id: 'military',
	name: 'Military unit',
	color: '#e74c3c', // Red
	icon: 'shield',
	builtIn: true
};

/**
 * Religious - Churches, monasteries, religious orders
 */
export const RELIGIOUS: OrganizationTypeDefinition = {
	id: 'religious',
	name: 'Religious order',
	color: '#f1c40f', // Gold
	icon: 'church',
	builtIn: true
};

/**
 * Political - Kingdoms, republics, political parties
 */
export const POLITICAL: OrganizationTypeDefinition = {
	id: 'political',
	name: 'Political entity',
	color: '#27ae60', // Green
	icon: 'landmark',
	builtIn: true
};

/**
 * Educational - Schools, universities, academies
 */
export const EDUCATIONAL: OrganizationTypeDefinition = {
	id: 'educational',
	name: 'Educational',
	color: '#1abc9c', // Teal
	icon: 'graduation-cap',
	builtIn: true
};

/**
 * Custom - User-defined organization type (fallback)
 */
export const CUSTOM: OrganizationTypeDefinition = {
	id: 'custom',
	name: 'Other',
	color: '#95a5a6', // Gray
	icon: 'folder',
	builtIn: true
};

/**
 * All built-in organization types
 */
export const DEFAULT_ORGANIZATION_TYPES: OrganizationTypeDefinition[] = [
	NOBLE_HOUSE,
	GUILD,
	CORPORATION,
	MILITARY,
	RELIGIOUS,
	POLITICAL,
	EDUCATIONAL,
	CUSTOM
];

/**
 * Get organization type definition by ID
 */
export function getOrganizationType(typeId: OrganizationType): OrganizationTypeDefinition {
	const found = DEFAULT_ORGANIZATION_TYPES.find(t => t.id === typeId);
	return found || CUSTOM;
}

/**
 * Get all organization types (built-in + custom from settings)
 */
export function getAllOrganizationTypes(
	customTypes: OrganizationTypeDefinition[] = []
): OrganizationTypeDefinition[] {
	return [...DEFAULT_ORGANIZATION_TYPES, ...customTypes.filter(t => !t.builtIn)];
}

/**
 * Check if a string is a valid organization type ID
 */
export function isValidOrganizationType(typeId: string): typeId is OrganizationType {
	return DEFAULT_ORGANIZATION_TYPES.some(t => t.id === typeId);
}
