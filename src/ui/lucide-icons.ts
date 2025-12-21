/**
 * Lucide icon helper utilities for Canvas Roots Control Center
 * Obsidian provides Lucide icons via setIcon API
 */

import { addIcon, setIcon } from 'obsidian';

/**
 * Custom SVG icons for visual tree reports (V2 designs from planning doc)
 * Following Lucide design guidelines: 24x24 canvas, 2px stroke, round caps/joins
 */
const CUSTOM_ICONS: Record<string, string> = {
	'pedigree-tree': `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="20" r="2.5"/>
  <circle cx="5" cy="11" r="2"/>
  <circle cx="19" cy="11" r="2"/>
  <circle cx="5" cy="3" r="1.5"/>
  <circle cx="19" cy="3" r="1.5"/>
  <line x1="10" y1="18" x2="6.5" y2="13"/>
  <line x1="14" y1="18" x2="17.5" y2="13"/>
  <line x1="5" y1="9" x2="5" y2="4.5"/>
  <line x1="19" y1="9" x2="19" y2="4.5"/>
</svg>`,
	'descendant-tree': `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="4" r="2.5"/>
  <circle cx="5" cy="13" r="2"/>
  <circle cx="19" cy="13" r="2"/>
  <circle cx="5" cy="21" r="1.5"/>
  <circle cx="19" cy="21" r="1.5"/>
  <line x1="10" y1="6" x2="6.5" y2="11"/>
  <line x1="14" y1="6" x2="17.5" y2="11"/>
  <line x1="5" y1="15" x2="5" y2="19.5"/>
  <line x1="19" y1="15" x2="19" y2="19.5"/>
</svg>`,
	'hourglass-tree': `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="2.5"/>
  <circle cx="4" cy="4" r="2"/>
  <circle cx="20" cy="4" r="2"/>
  <circle cx="4" cy="20" r="2"/>
  <circle cx="20" cy="20" r="2"/>
  <line x1="10" y1="10" x2="5.5" y2="5.5"/>
  <line x1="14" y1="10" x2="18.5" y2="5.5"/>
  <line x1="10" y1="14" x2="5.5" y2="18.5"/>
  <line x1="14" y1="14" x2="18.5" y2="18.5"/>
</svg>`,
	'fan-chart': `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M 2 20 A 12 12 0 0 1 22 20"/>
  <path d="M 6 20 A 8 8 0 0 1 18 20"/>
  <line x1="12" y1="20" x2="12" y2="8"/>
  <line x1="12" y1="20" x2="4" y2="12"/>
  <line x1="12" y1="20" x2="20" y2="12"/>
</svg>`
};

/**
 * Register custom icons with Obsidian
 * Should be called once during plugin initialization
 */
export function registerCustomIcons(): void {
	for (const [name, svg] of Object.entries(CUSTOM_ICONS)) {
		addIcon(name, svg);
	}
}

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
	| 'chevron-left'   // Navigation back
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
	| 'network'        // Network/connected trees
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
	| 'briefcase' // Occupation/work
	// Visual tree reports
	| 'file-image' // PDF/image export
	| 'git-fork' // Descendant tree fallback
	| 'hourglass' // Hourglass tree fallback
	| 'pie-chart' // Fan chart fallback
	// Custom icons (registered via addIcon)
	| 'pedigree-tree' // Pedigree tree icon
	| 'descendant-tree' // Descendant tree icon
	| 'hourglass-tree' // Hourglass tree icon
	| 'fan-chart' // Fan chart icon
	// Unified wizard
	| 'layout-dashboard'; // Canvas output format

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
		id: 'dashboard',
		name: 'Dashboard',
		icon: 'home',
		description: 'Quick actions and vault overview'
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
		id: 'universes',
		name: 'Universes',
		icon: 'globe',
		description: 'Manage fictional universes and worlds'
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
		name: 'Canvas Trees',
		icon: 'git-branch',
		description: 'Generate interactive tree canvases'
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
