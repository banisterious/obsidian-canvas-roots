/**
 * Lucide icon helper utilities for Canvas Roots Control Center
 * Obsidian provides Lucide icons via setIcon API
 */

import { setIcon } from 'obsidian';

/**
 * Lucide icon names used in Control Center
 */
export type LucideIconName =
	| 'activity'       // Status tab
	| 'zap'            // Quick Actions tab
	| 'user-plus'      // Data Entry tab
	| 'git-branch'     // Tree Generation tab
	| 'git-compare'    // Relationship calculator
	| 'file-text'      // GEDCOM tab
	| 'user'           // Person Details tab
	| 'settings'       // Advanced tab
	| 'book-open'      // Guide tab
	| 'users'          // Multiple people icon
	| 'calendar'       // Date picker
	| 'search'         // Search icon
	| 'folder'         // Folder browser
	| 'x'              // Close button
	| 'check'          // Success/complete
	| 'alert-circle'   // Warning
	| 'alert-triangle' // Error
	| 'info'           // Information
	| 'chevron-right'  // Navigation
	| 'chevron-down'   // Dropdown
	| 'plus'           // Add/create
	| 'minus'          // Remove
	| 'edit'           // Edit
	| 'trash'          // Delete
	| 'refresh-cw'     // Refresh/recalculate
	| 'download'       // Download/export
	| 'upload'         // Upload/import
	| 'link'           // Link relationship
	| 'unlink'         // Unlink relationship
	| 'external-link'  // Open external
	| 'eye'            // View
	| 'eye-off'        // Hide
	| 'file-plus'      // Create file
	| 'hash'           // ID/identifier
	| 'heart'          // Health/status
	| 'layout'         // Layout options
	| 'file'           // File/canvas
	| 'play'           // Generate/run action
	| 'clock'          // Time/recent items
	| 'crown'          // Root person marker
	| 'arrow-up'       // Direction up
	| 'arrow-down'     // Direction down
	| 'arrow-right'    // Direction right/lateral
	| 'copy'           // Copy to clipboard
	| 'circle'         // Neutral/dot indicator
	| 'home'           // Family/home
	| 'baby'           // Child icon
	| 'bar-chart'      // Statistics
	| 'bar-chart-2'    // Folder statistics
	| 'maximize-2'     // Largest
	| 'minimize-2'     // Smallest
	| 'undo-2'         // Undo action
	| 'history'        // History view
	| 'user-minus'     // Remove person
	| 'table-2'        // CSV/spreadsheet
	| 'package'        // Staging/import packages
	| 'shield-check'   // Data quality
	| 'layers'         // Layers/generations
	| 'arrow-up-down'; // Bidirectional/ancestor-descendant

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
		id: 'guide',
		name: 'Guide',
		icon: 'book-open',
		description: 'Quick start guide and getting started'
	},
	{
		id: 'quick-actions',
		name: 'Quick actions',
		icon: 'zap',
		description: 'Frequently used commands'
	},
	{
		id: 'import-export',
		name: 'Import/Export',
		icon: 'file-text',
		description: 'Import and export genealogical data (GEDCOM, CSV)'
	},
	{
		id: 'staging',
		name: 'Staging',
		icon: 'package',
		description: 'Review and promote imported data'
	},
	{
		id: 'data-quality',
		name: 'Data quality',
		icon: 'shield-check',
		description: 'Analyze data quality and find issues'
	},
	{
		id: 'data-entry',
		name: 'Data entry',
		icon: 'user-plus',
		description: 'Create new person notes'
	},
	{
		id: 'collections',
		name: 'Collections',
		icon: 'folder',
		description: 'Browse and organize family groups and collections'
	},
	{
		id: 'tree-generation',
		name: 'Tree output',
		icon: 'git-branch',
		description: 'Generate trees and export to various formats'
	},
	{
		id: 'quick-settings',
		name: 'Canvas settings',
		icon: 'settings',
		description: 'Canvas layout and arrow styling settings'
	},
	{
		id: 'person-detail',
		name: 'Person details',
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
	iconEl.addClass('crc-icon', 'cr-lucide-icon');
	iconEl.style.width = `${size}px`;
	iconEl.style.height = `${size}px`;

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
	element.addClass('crc-icon', 'cr-lucide-icon');
	element.style.width = `${size}px`;
	element.style.height = `${size}px`;

	setIcon(element, iconName);
}
