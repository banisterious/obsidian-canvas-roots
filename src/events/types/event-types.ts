/**
 * Event Types for Chronological Story Mapping
 *
 * Defines types and interfaces for event notes, supporting genealogists,
 * worldbuilders, and writers with timeline visualization.
 */

import type { TFile } from 'obsidian';
import type { LucideIconName } from '../../ui/lucide-icons';

/**
 * Confidence level for event accuracy
 */
export type EventConfidence = 'high' | 'medium' | 'low' | 'unknown';

/**
 * Date precision for event dates
 */
export type DatePrecision =
	| 'exact'      // Known to the day: 1850-03-15
	| 'month'      // Known to the month: 1850-03
	| 'year'       // Known to the year: 1850
	| 'decade'     // Known to the decade: 1850s
	| 'estimated'  // Approximate: "circa 1850"
	| 'range'      // Between two dates: 1848-1852
	| 'unknown';   // Date unknown, use relative ordering

/**
 * Built-in event type categories
 */
export type BuiltInEventTypeCategory = 'vital' | 'life' | 'narrative';

/**
 * Event type category for grouping (built-in or user-defined)
 */
export type EventTypeCategory = BuiltInEventTypeCategory | string;

/**
 * Definition of a user-created category
 */
export interface EventCategoryDefinition {
	id: string;
	name: string;
	sortOrder: number;
}

/**
 * Core event types (vital events)
 */
export const CORE_EVENT_TYPES = [
	'birth',
	'death',
	'marriage',
	'divorce'
] as const;

/**
 * Extended event types (common life events)
 */
export const EXTENDED_EVENT_TYPES = [
	'residence',
	'occupation',
	'military',
	'immigration',
	'education',
	'burial',
	'baptism',
	'confirmation',
	'ordination'
] as const;

/**
 * Narrative event types (for storytelling)
 */
export const NARRATIVE_EVENT_TYPES = [
	'anecdote',
	'lore_event',
	'plot_point',
	'flashback',
	'foreshadowing',
	'backstory',
	'climax',
	'resolution'
] as const;

/**
 * All built-in event types
 */
export const BUILT_IN_EVENT_TYPES = [
	...CORE_EVENT_TYPES,
	...EXTENDED_EVENT_TYPES,
	...NARRATIVE_EVENT_TYPES,
	'custom'
] as const;

export type BuiltInEventType = typeof BUILT_IN_EVENT_TYPES[number];

/**
 * Definition of an event type (built-in or custom)
 */
export interface EventTypeDefinition {
	id: string;
	name: string;
	description: string;
	icon: LucideIconName;
	color: string;
	category: EventTypeCategory;
	isBuiltIn: boolean;
}

/**
 * Built-in event type definitions
 */
export const EVENT_TYPE_DEFINITIONS: EventTypeDefinition[] = [
	// Vital events (birth, death, marriage, divorce)
	{
		id: 'birth',
		name: 'Birth',
		description: 'Birth of a person',
		icon: 'baby',
		color: '#4ade80',
		category: 'vital',
		isBuiltIn: true
	},
	{
		id: 'death',
		name: 'Death',
		description: 'Death of a person',
		icon: 'skull',
		color: '#6b7280',
		category: 'vital',
		isBuiltIn: true
	},
	{
		id: 'marriage',
		name: 'Marriage',
		description: 'Marriage ceremony',
		icon: 'heart',
		color: '#f472b6',
		category: 'vital',
		isBuiltIn: true
	},
	{
		id: 'divorce',
		name: 'Divorce',
		description: 'Divorce or annulment',
		icon: 'heart-off',
		color: '#ef4444',
		category: 'vital',
		isBuiltIn: true
	},

	// Life events (common non-vital life events)
	{
		id: 'residence',
		name: 'Residence',
		description: 'Change of residence',
		icon: 'home',
		color: '#60a5fa',
		category: 'life',
		isBuiltIn: true
	},
	{
		id: 'occupation',
		name: 'Occupation',
		description: 'Employment or career change',
		icon: 'hammer',
		color: '#a78bfa',
		category: 'life',
		isBuiltIn: true
	},
	{
		id: 'military',
		name: 'Military',
		description: 'Military service event',
		icon: 'shield',
		color: '#2e8b57',
		category: 'life',
		isBuiltIn: true
	},
	{
		id: 'immigration',
		name: 'Immigration',
		description: 'Immigration or emigration',
		icon: 'ship',
		color: '#4169e1',
		category: 'life',
		isBuiltIn: true
	},
	{
		id: 'education',
		name: 'Education',
		description: 'Educational milestone',
		icon: 'graduation-cap',
		color: '#fbbf24',
		category: 'life',
		isBuiltIn: true
	},
	{
		id: 'burial',
		name: 'Burial',
		description: 'Burial or interment',
		icon: 'map-pin',
		color: '#78716c',
		category: 'life',
		isBuiltIn: true
	},
	{
		id: 'baptism',
		name: 'Baptism',
		description: 'Baptism or christening',
		icon: 'droplets',
		color: '#38bdf8',
		category: 'life',
		isBuiltIn: true
	},
	{
		id: 'confirmation',
		name: 'Confirmation',
		description: 'Religious confirmation',
		icon: 'church',
		color: '#9b59b6',
		category: 'life',
		isBuiltIn: true
	},
	{
		id: 'ordination',
		name: 'Ordination',
		description: 'Religious ordination',
		icon: 'book-open',
		color: '#7c3aed',
		category: 'life',
		isBuiltIn: true
	},

	// Narrative events (for storytelling and worldbuilding)
	{
		id: 'anecdote',
		name: 'Anecdote',
		description: 'Family story or personal event',
		icon: 'mic',
		color: '#fb923c',
		category: 'narrative',
		isBuiltIn: true
	},
	{
		id: 'lore_event',
		name: 'Lore event',
		description: 'Worldbuilding canonical event',
		icon: 'scroll',
		color: '#daa520',
		category: 'narrative',
		isBuiltIn: true
	},
	{
		id: 'plot_point',
		name: 'Plot point',
		description: 'Key story beat or turning point',
		icon: 'bookmark',
		color: '#eab308',
		category: 'narrative',
		isBuiltIn: true
	},
	{
		id: 'flashback',
		name: 'Flashback',
		description: 'Event referenced in non-chronological narrative',
		icon: 'history',
		color: '#a3a3a3',
		category: 'narrative',
		isBuiltIn: true
	},
	{
		id: 'foreshadowing',
		name: 'Foreshadowing',
		description: 'Event that sets up future developments',
		icon: 'eye',
		color: '#c084fc',
		category: 'narrative',
		isBuiltIn: true
	},
	{
		id: 'backstory',
		name: 'Backstory',
		description: 'Pre-narrative event that informs character/plot',
		icon: 'history',
		color: '#94a3b8',
		category: 'narrative',
		isBuiltIn: true
	},
	{
		id: 'climax',
		name: 'Climax',
		description: 'Peak dramatic moment',
		icon: 'zap',
		color: '#f43f5e',
		category: 'narrative',
		isBuiltIn: true
	},
	{
		id: 'resolution',
		name: 'Resolution',
		description: 'Story conclusion event',
		icon: 'check',
		color: '#22c55e',
		category: 'narrative',
		isBuiltIn: true
	}
];

/**
 * Human-readable labels for event types
 */
export const EVENT_TYPE_LABELS: Record<string, string> = Object.fromEntries(
	EVENT_TYPE_DEFINITIONS.map(def => [def.id, def.name])
);

/**
 * Human-readable labels for date precision
 */
export const DATE_PRECISION_LABELS: Record<DatePrecision, string> = {
	exact: 'Exact date',
	month: 'Month only',
	year: 'Year only',
	decade: 'Decade',
	estimated: 'Estimated',
	range: 'Date range',
	unknown: 'Unknown'
};

/**
 * Human-readable labels for confidence levels
 */
export const CONFIDENCE_LABELS: Record<EventConfidence, string> = {
	high: 'High',
	medium: 'Medium',
	low: 'Low',
	unknown: 'Unknown'
};

/**
 * Event note data extracted from frontmatter
 */
export interface EventNote {
	/** File reference */
	file: TFile;
	/** File path in vault */
	filePath: string;
	/** Unique identifier */
	crId: string;
	/** Display title */
	title: string;
	/** Type of event */
	eventType: string;
	/** Event date (ISO format or fictional calendar) */
	date?: string;
	/** End date for ranges */
	dateEnd?: string;
	/** How precise the date is */
	datePrecision: DatePrecision;
	/** Primary person involved (wikilink) */
	person?: string;
	/** Multiple people involved (wikilinks) */
	persons?: string[];
	/** Where the event occurred (wikilink to place note) */
	place?: string;
	/** Sources documenting this event (wikilinks) */
	sources?: string[];
	/** Confidence level */
	confidence: EventConfidence;
	/** Additional details */
	description?: string;
	/** For worldbuilders: this is authoritative truth */
	isCanonical?: boolean;
	/** Fictional universe */
	universe?: string;
	/** Fictional date system ID */
	dateSystem?: string;
	/** Events that happen after this one (for relative ordering) */
	before?: string[];
	/** Events that happen before this one (for relative ordering) */
	after?: string[];
	/** Parent timeline note */
	timeline?: string;
	/** Computed sort value for Bases */
	sortOrder?: number;
	/** Groups/factions involved in this event (for filtering by nation, faction, etc.) */
	groups?: string[];
}

/**
 * Data for creating a new event note
 */
export interface CreateEventData {
	title: string;
	eventType: string;
	date?: string;
	dateEnd?: string;
	datePrecision: DatePrecision;
	person?: string;
	persons?: string[];
	place?: string;
	sources?: string[];
	confidence?: EventConfidence;
	description?: string;
	isCanonical?: boolean;
	universe?: string;
	dateSystem?: string;
	before?: string[];
	after?: string[];
	timeline?: string;
	groups?: string[];
}

/**
 * Data for updating an event note
 */
export type UpdateEventData = Partial<CreateEventData>;

/**
 * Summary statistics for events
 */
export interface EventStats {
	totalEvents: number;
	byType: Record<string, number>;
	byPerson: Record<string, number>;
	byPlace: Record<string, number>;
	byGroup: Record<string, number>;
	byConfidence: Record<EventConfidence, number>;
	withSources: number;
	withoutSources: number;
	withDates: number;
	withRelativeOrdering: number;
}

/**
 * Options for retrieving event types
 */
export interface EventTypeOptions {
	/** User-defined event types */
	customTypes?: EventTypeDefinition[];
	/** Whether to include built-in types */
	showBuiltIn?: boolean;
	/** Customizations for built-in types (overrides) */
	customizations?: Record<string, Partial<EventTypeDefinition>>;
	/** Hidden type IDs (excluded from getAllEventTypes but still resolved by getEventType) */
	hiddenTypes?: string[];
}

/**
 * Get an event type definition by ID
 * Always returns the type if it exists, even if hidden (for existing notes)
 */
export function getEventType(
	typeId: string,
	customTypes: EventTypeDefinition[] = [],
	showBuiltIn = true,
	customizations?: Record<string, Partial<EventTypeDefinition>>
): EventTypeDefinition | undefined {
	// Check custom types first
	const customType = customTypes.find(t => t.id === typeId);
	if (customType) return customType;

	// Check built-in types
	if (showBuiltIn) {
		const builtIn = EVENT_TYPE_DEFINITIONS.find(t => t.id === typeId);
		if (builtIn) {
			// Apply customizations if any
			const overrides = customizations?.[typeId];
			if (overrides) {
				return {
					...builtIn,
					...overrides,
					isBuiltIn: true // Always preserve this
				};
			}
			return builtIn;
		}
	}

	return undefined;
}

/**
 * Get all available event types
 * Respects customizations and hidden types
 */
export function getAllEventTypes(
	customTypes: EventTypeDefinition[] = [],
	showBuiltIn = true,
	customizations?: Record<string, Partial<EventTypeDefinition>>,
	hiddenTypes?: string[]
): EventTypeDefinition[] {
	const types: EventTypeDefinition[] = [];
	const hidden = new Set(hiddenTypes ?? []);

	if (showBuiltIn) {
		for (const builtIn of EVENT_TYPE_DEFINITIONS) {
			// Skip hidden types
			if (hidden.has(builtIn.id)) continue;

			// Apply customizations if any
			const overrides = customizations?.[builtIn.id];
			if (overrides) {
				types.push({
					...builtIn,
					...overrides,
					isBuiltIn: true
				});
			} else {
				types.push(builtIn);
			}
		}
	}

	// Add user-defined types (excluding hidden ones)
	for (const custom of customTypes) {
		if (!hidden.has(custom.id)) {
			types.push(custom);
		}
	}

	return types;
}

/**
 * Group event types by category
 */
export function getEventTypesByCategory(
	customTypes: EventTypeDefinition[] = [],
	showBuiltIn = true,
	customizations?: Record<string, Partial<EventTypeDefinition>>,
	hiddenTypes?: string[],
	customCategories: EventCategoryDefinition[] = [],
	categoryCustomizations?: Record<string, Partial<EventCategoryDefinition>>,
	hiddenCategories?: string[]
): Record<string, EventTypeDefinition[]> {
	const types = getAllEventTypes(customTypes, showBuiltIn, customizations, hiddenTypes);
	const allCategories = getAllCategories(customCategories, categoryCustomizations, hiddenCategories);

	// Initialize grouped object with all categories
	const grouped: Record<string, EventTypeDefinition[]> = {};
	for (const cat of allCategories) {
		grouped[cat.id] = [];
	}

	// Group types into their categories
	for (const type of types) {
		if (!grouped[type.category]) {
			grouped[type.category] = [];
		}
		grouped[type.category].push(type);
	}

	return grouped;
}

/**
 * Built-in category definitions
 */
export const BUILT_IN_CATEGORIES: EventCategoryDefinition[] = [
	{ id: 'vital', name: 'Vital events', sortOrder: 0 },
	{ id: 'life', name: 'Life events', sortOrder: 1 },
	{ id: 'narrative', name: 'Narrative events', sortOrder: 2 }
];

/**
 * Options for getting categories
 */
export interface CategoryOptions {
	customCategories?: EventCategoryDefinition[];
	customizations?: Record<string, Partial<EventCategoryDefinition>>;
	hiddenCategories?: string[];
}

/**
 * Get all categories (built-in + custom)
 * Supports customizations and hiding of built-in categories
 */
export function getAllCategories(
	customCategories: EventCategoryDefinition[] = [],
	customizations?: Record<string, Partial<EventCategoryDefinition>>,
	hiddenCategories?: string[]
): EventCategoryDefinition[] {
	const hidden = new Set(hiddenCategories ?? []);
	const categories: EventCategoryDefinition[] = [];

	// Add built-in categories (with customizations, excluding hidden)
	for (const builtIn of BUILT_IN_CATEGORIES) {
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
 * Get category display name
 * Respects customizations for built-in categories
 */
export function getCategoryName(
	categoryId: string,
	customCategories: EventCategoryDefinition[] = [],
	customizations?: Record<string, Partial<EventCategoryDefinition>>
): string {
	// Check customizations first for built-in categories
	const customization = customizations?.[categoryId];
	if (customization?.name) return customization.name;

	const builtIn = BUILT_IN_CATEGORIES.find(c => c.id === categoryId);
	if (builtIn) return builtIn.name;

	const custom = customCategories.find(c => c.id === categoryId);
	if (custom) return custom.name;

	// Fallback: capitalize the ID
	return categoryId.charAt(0).toUpperCase() + categoryId.slice(1);
}

/**
 * Check if a string is a valid built-in event type
 */
export function isBuiltInEventType(type: string): type is BuiltInEventType {
	return (BUILT_IN_EVENT_TYPES as readonly string[]).includes(type);
}

/**
 * Check if a category is built-in
 */
export function isBuiltInCategory(categoryId: string): boolean {
	return BUILT_IN_CATEGORIES.some(c => c.id === categoryId);
}

/**
 * Get the category for an event type
 */
export function getEventTypeCategory(typeId: string): EventTypeCategory {
	if ((CORE_EVENT_TYPES as readonly string[]).includes(typeId)) return 'vital';
	if ((EXTENDED_EVENT_TYPES as readonly string[]).includes(typeId)) return 'life';
	if ((NARRATIVE_EVENT_TYPES as readonly string[]).includes(typeId)) return 'narrative';
	return 'life'; // Default to life events for unknown types
}
