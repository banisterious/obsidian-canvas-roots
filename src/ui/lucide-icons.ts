/**
 * Lucide icon helper utilities for Canvas Roots Control Center
 * Obsidian provides Lucide icons via setIcon API
 */

import { setIcon } from 'obsidian';

/**
 * Lucide icon names used in Control Center
 */
export type LucideIconName =
	| 'activity'      // Status tab
	| 'zap'           // Quick Actions tab
	| 'user-plus'     // Data Entry tab
	| 'git-branch'    // Tree Generation tab
	| 'file-text'     // GEDCOM tab
	| 'user'          // Person Details tab
	| 'settings'      // Advanced tab
	| 'users'         // Multiple people icon
	| 'calendar'      // Date picker
	| 'search'        // Search icon
	| 'folder'        // Folder browser
	| 'x'             // Close button
	| 'check'         // Success/complete
	| 'alert-circle'  // Warning
	| 'alert-triangle' // Error
	| 'info'          // Information
	| 'chevron-right' // Navigation
	| 'chevron-down'  // Dropdown
	| 'plus'          // Add/create
	| 'minus'         // Remove
	| 'edit'          // Edit
	| 'trash'         // Delete
	| 'refresh-cw'    // Refresh/recalculate
	| 'download'      // Download/export
	| 'upload'        // Upload/import
	| 'link'          // Link relationship
	| 'external-link' // Open external
	| 'eye'           // View
	| 'eye-off';      // Hide

/**
 * Tab configuration for Control Center navigation
 */
export interface TabConfig {
	id: string;
	name: string;
	icon: LucideIconName;
	description: string;
}

/**
 * Control Center tab configurations
 */
export const TAB_CONFIGS: TabConfig[] = [
	{
		id: 'status',
		name: 'Status',
		icon: 'activity',
		description: 'Vault statistics and health checks'
	},
	{
		id: 'quick-actions',
		name: 'Quick Actions',
		icon: 'zap',
		description: 'Frequently used commands'
	},
	{
		id: 'data-entry',
		name: 'Data Entry',
		icon: 'user-plus',
		description: 'Create new person notes'
	},
	{
		id: 'tree-generation',
		name: 'Tree Generation',
		icon: 'git-branch',
		description: 'Configure tree layout and styling'
	},
	{
		id: 'gedcom',
		name: 'GEDCOM',
		icon: 'file-text',
		description: 'Import and export genealogical data'
	},
	{
		id: 'person-detail',
		name: 'Person Details',
		icon: 'user',
		description: 'Person detail panel settings'
	},
	{
		id: 'advanced',
		name: 'Advanced',
		icon: 'settings',
		description: 'Advanced features and settings'
	}
];

/**
 * Create a Lucide icon element
 *
 * @param iconName - Name of the Lucide icon
 * @param size - Icon size in pixels (default: 20)
 * @returns HTMLElement with the icon rendered
 */
export function createLucideIcon(iconName: LucideIconName, size: number = 20): HTMLElement {
	const iconEl = document.createElement('span');
	iconEl.addClass('crc-icon');
	iconEl.style.width = `${size}px`;
	iconEl.style.height = `${size}px`;
	iconEl.style.display = 'inline-flex';
	iconEl.style.alignItems = 'center';
	iconEl.style.justifyContent = 'center';

	setIcon(iconEl, iconName);

	return iconEl;
}

/**
 * Set icon on an existing element
 *
 * @param element - Target element
 * @param iconName - Name of the Lucide icon
 * @param size - Icon size in pixels (default: 20)
 */
export function setLucideIcon(element: HTMLElement, iconName: LucideIconName, size: number = 20): void {
	element.empty();
	element.addClass('crc-icon');
	element.style.width = `${size}px`;
	element.style.height = `${size}px`;
	element.style.display = 'inline-flex';
	element.style.alignItems = 'center';
	element.style.justifyContent = 'center';

	setIcon(element, iconName);
}
