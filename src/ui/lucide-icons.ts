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
	| 'zap'            // Bulk actions
	| 'user-plus'      // Data Entry tab
	| 'git-branch'     // Tree Generation tab
	| 'git-compare'    // Relationship calculator
	| 'file-text'      // GEDCOM tab
	| 'user'           // Person Details tab
	| 'settings'       // Canvas settings tab
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
	| 'arrow-up-down'  // Bidirectional/ancestor-descendant
	| 'map-pin'        // Places/locations
	| 'globe'          // World/geography
	| 'file-code'      // Templates/code files
	| 'lightbulb'      // Ideas/concepts
	| 'list-checks'    // Task lists
	| 'map'            // Map view
	| 'more-vertical' // Overflow menu
	| 'clipboard-check' // Schema validation
	| 'file-check' // Schema note
	| 'link-2' // Relationships
	| 'building' // Organizations tab
	| 'building-2' // Corporation
	| 'hammer' // Guild
	| 'church' // Religious
	| 'landmark' // Political
	| 'graduation-cap' // Educational
	| 'shield' // Military
	// Source types
	| 'bookmark' // Obituary
	| 'gavel' // Court records
	| 'scroll' // Probate
	| 'ship' // Immigration
	| 'image' // Photos
	| 'mail' // Correspondence
	| 'newspaper' // Newspaper articles
	| 'mic' // Oral history
	| 'archive' // Sources tab
	| 'scale' // Proof summaries (weighing evidence)
	| 'sliders' // Preferences tab
	// Event types
	| 'skull' // Death
	| 'heart-off' // Divorce
	| 'droplets' // Baptism
	| 'calendar-plus' // Extract events
	| 'calendar-check' // Create events
	| 'star' // Star marker
	| 'flag' // Flag marker
	| 'check-circle' // Success indicator
	| 'circle-off' // Disabled/off state
	| 'help-circle' // Help/unknown
	// Data enhancement
	| 'sparkles' // Enhancement/magic
	| 'plus-circle' // Add/create new
	// Statistics
	| 'briefcase'; // Occupation/work

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
		id: 'import-export',
		name: 'Import/Export',
		icon: 'file-text',
		description: 'Import and export genealogical data (GEDCOM, CSV)'
	},
	{
		id: 'people',
		name: 'People',
		icon: 'users',
		description: 'Person notes, statistics, and data entry'
	},
	{
		id: 'events',
		name: 'Events',
		icon: 'calendar',
		description: 'Date systems and temporal data'
	},
	{
		id: 'places',
		name: 'Places',
		icon: 'map-pin',
		description: 'Geographic locations and place statistics'
	},
	{
		id: 'maps',
		name: 'Maps',
		icon: 'map',
		description: 'Map visualizations and custom maps'
	},
	{
		id: 'sources',
		name: 'Sources',
		icon: 'archive',
		description: 'Evidence and source documentation'
	},
	{
		id: 'schemas',
		name: 'Schemas',
		icon: 'clipboard-check',
		description: 'Validation schemas for data consistency'
	},
	{
		id: 'relationships',
		name: 'Relationships',
		icon: 'link-2',
		description: 'Custom relationship types and connections'
	},
	{
		id: 'organizations',
		name: 'Organizations',
		icon: 'building',
		description: 'Manage organizations and memberships'
	},
	{
		id: 'collections',
		name: 'Collections',
		icon: 'folder',
		description: 'Browse and organize family groups and collections'
	},
	{
		id: 'data-quality',
		name: 'Data quality',
		icon: 'shield-check',
		description: 'Analyze data quality and find issues'
	},
	{
		id: 'statistics',
		name: 'Statistics',
		icon: 'bar-chart-2',
		description: 'Vault statistics, data completeness, and quality metrics'
	},
	{
		id: 'tree-generation',
		name: 'Tree output',
		icon: 'git-branch',
		description: 'Generate trees and export to various formats'
	},
	{
		id: 'preferences',
		name: 'Preferences',
		icon: 'sliders',
		description: 'Aliases, folder locations, and canvas settings'
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
	iconEl.style.setProperty('width', `${size}px`);
	iconEl.style.setProperty('height', `${size}px`);

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
	element.setCssStyles({
		width: `${size}px`,
		height: `${size}px`
	});

	setIcon(element, iconName);
}
