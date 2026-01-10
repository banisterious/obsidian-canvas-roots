/**
 * Calendarium Bridge Service
 *
 * Provides integration with the Calendarium plugin for shared calendar definitions.
 * This bridge enables Charted Roots to read calendar systems defined in Calendarium,
 * eliminating the need for duplicate configuration.
 *
 * @see https://github.com/javalent/calendarium
 */

import { App } from 'obsidian';
import type { FictionalDateSystem, FictionalEra } from '../dates/types/date-types';

/**
 * Calendarium's internal date structure
 * Uses 0-indexed months (January = 0)
 */
export interface CalendariumDate {
	year: number;
	month: number;
	day: number;
}

/**
 * Calendarium era definition
 * Based on Calendarium's Era type from src/schemas/calendar/timespans.ts
 *
 * Eras can be:
 * - Starting era: isStartingEra=true, no date property (represents epoch 0)
 * - Regular era: has date property with year/month/day
 */
interface CalendariumEra {
	name: string;
	format: string;
	description?: string;
	/** Date when this era begins (not present for starting eras) */
	date?: CalendariumDate;
	/** End date of this era */
	end?: CalendariumDate;
	/** Whether this is the starting era (epoch 0, no date property) */
	isStartingEra?: boolean;
	/** Whether years count backwards in this era (like BC/BCE) */
	endsYear?: boolean;
	/** Whether this era appears as an event */
	isEvent?: boolean;
}

/**
 * Calendarium month definition
 */
interface CalendariumMonth {
	name: string;
	length: number;
	type?: string;
}

/**
 * Calendarium calendar definition (subset of what we need)
 */
interface CalendariumCalendar {
	name: string;
	id?: string;
	description?: string;
	static?: {
		months?: CalendariumMonth[];
		eras?: CalendariumEra[];
		year?: number;
	};
}

/**
 * Calendarium API interface (partial - only what we use)
 */
interface CalendariumAPI {
	getCalendars(): string[];
	getAPI(calendarName: string): CalendariumCalendarAPI | undefined;
	onSettingsLoaded(callback: () => void): void;
}

/**
 * Calendarium calendar-specific API
 */
interface CalendariumCalendarAPI {
	parseDate(dateString: string): CalendariumDate | null;
	toDisplayDate(date: CalendariumDate): string;
	getEventsOnDay(date: CalendariumDate): unknown[];
	translate?(date: CalendariumDate, fromCalendar: string, toCalendar: string): CalendariumDate | null;
	calendar?: CalendariumCalendar;
}

/**
 * Bridge service for Calendarium plugin integration
 *
 * Provides methods to:
 * - Detect if Calendarium is installed and enabled
 * - Import calendar definitions as FictionalDateSystem objects
 * - Convert between Calendarium and Charted Roots date formats
 */
export class CalendariumBridge {
	private app: App;
	private api: CalendariumAPI | null = null;
	private initialized = false;
	private initPromise: Promise<boolean> | null = null;

	constructor(app: App) {
		this.app = app;
	}

	/**
	 * Check if Calendarium plugin is installed and enabled
	 */
	isAvailable(): boolean {
		const appWithPlugins = this.app as unknown as { plugins?: { enabledPlugins?: Set<string> } };
		const isEnabled = appWithPlugins.plugins?.enabledPlugins?.has('calendarium') ?? false;
		return isEnabled && !!(window as Window & { Calendarium?: CalendariumAPI }).Calendarium;
	}

	/**
	 * Initialize the bridge by waiting for Calendarium settings to load
	 * Returns true if initialization succeeded, false otherwise
	 */
	async initialize(): Promise<boolean> {
		if (this.initialized) {
			return this.api !== null;
		}

		// Return existing promise if initialization is in progress
		if (this.initPromise) {
			return this.initPromise;
		}

		this.initPromise = this.doInitialize();
		return this.initPromise;
	}

	private async doInitialize(): Promise<boolean> {
		if (!this.isAvailable()) {
			this.initialized = true;
			return false;
		}

		return new Promise((resolve) => {
			const calendarium = (window as Window & { Calendarium?: CalendariumAPI }).Calendarium;
			if (!calendarium) {
				this.initialized = true;
				resolve(false);
				return;
			}

			// Wait for Calendarium settings to be loaded
			calendarium.onSettingsLoaded(() => {
				this.api = calendarium;
				this.initialized = true;
				resolve(true);
			});

			// Timeout after 5 seconds in case callback never fires
			setTimeout(() => {
				if (!this.initialized) {
					this.initialized = true;
					resolve(false);
				}
			}, 5000);
		});
	}

	/**
	 * Get list of calendar names from Calendarium
	 */
	getCalendarNames(): string[] {
		if (!this.api) {
			return [];
		}
		return this.api.getCalendars();
	}

	/**
	 * Get the Calendarium API for a specific calendar
	 */
	getCalendarAPI(calendarName: string): CalendariumCalendarAPI | undefined {
		if (!this.api) {
			return undefined;
		}
		return this.api.getAPI(calendarName);
	}

	/**
	 * Import all Calendarium calendars as FictionalDateSystem objects
	 * These can be used alongside Charted Roots' built-in and custom date systems
	 */
	importCalendars(): FictionalDateSystem[] {
		if (!this.api) {
			return [];
		}

		const systems: FictionalDateSystem[] = [];
		const calendarNames = this.api.getCalendars();

		for (const name of calendarNames) {
			const calApi = this.api.getAPI(name);
			if (!calApi) {
				continue;
			}

			// Use getObject() method to get the calendar data
			const anyCalApi = calApi as unknown as {
				getObject?: () => CalendariumCalendar | undefined;
			};
			const calendar = anyCalApi.getObject?.();

			if (!calendar) {
				continue;
			}

			const system = this.convertToDateSystem(calendar);
			if (system) {
				systems.push(system);
			}
		}

		return systems;
	}

	/**
	 * Convert a Calendarium calendar to a Charted Roots FictionalDateSystem
	 */
	private convertToDateSystem(calendar: CalendariumCalendar): FictionalDateSystem | null {
		const eras = calendar.static?.eras;
		if (!eras || eras.length === 0) {
			// Calendar without eras - create a default era
			return {
				id: this.generateId(calendar.name),
				name: calendar.name,
				eras: [{
					id: 'default',
					name: 'Default Era',
					abbrev: 'DE',
					epoch: 0,
					direction: 'forward'
				}],
				source: 'calendarium',
				calendariumName: calendar.name
			};
		}

		// Convert Calendarium eras to Charted Roots format
		const convertedEras: FictionalEra[] = eras.map((era) => {
			// Starting eras have no date property and represent epoch 0
			// Regular eras have a date property with year/month/day
			const epoch = era.isStartingEra ? 0 : (era.date?.year ?? 0);

			return {
				id: this.generateId(era.name),
				name: era.name,
				abbrev: this.extractAbbreviation(era.format, era.name),
				epoch,
				direction: era.endsYear ? 'backward' as const : 'forward' as const
			};
		});

		// Find the default era (starting era or first era)
		const defaultEra = eras.find(e => e.isStartingEra)?.name ||
			(convertedEras.length > 0 ? convertedEras[0].id : undefined);

		return {
			id: this.generateId(calendar.name),
			name: calendar.name,
			eras: convertedEras,
			defaultEra: defaultEra ? this.generateId(defaultEra) : undefined,
			source: 'calendarium',
			calendariumName: calendar.name
		};
	}

	/**
	 * Extract era abbreviation from Calendarium format string
	 * Format strings like "{{year}} {{era_name}}" contain the abbreviation
	 */
	private extractAbbreviation(format: string, fallbackName: string): string {
		// Calendarium format may contain era abbreviation directly
		// Common patterns: "TA {{year}}", "{{year}} AC", etc.
		// If format is just the pattern, derive from name

		// Try to extract letters that aren't format placeholders
		const cleaned = format
			.replace(/\{\{.*?\}\}/g, '')
			.replace(/[^a-zA-Z]/g, '')
			.trim();

		if (cleaned.length > 0 && cleaned.length <= 4) {
			return cleaned.toUpperCase();
		}

		// Fall back to generating abbreviation from name
		// "Third Age" -> "TA", "Before Christ" -> "BC"
		const words = fallbackName.split(/\s+/);
		if (words.length >= 2) {
			return words.map(w => w.charAt(0).toUpperCase()).join('');
		}

		// Single word: take first 2-3 characters
		return fallbackName.substring(0, 3).toUpperCase();
	}

	/**
	 * Generate a URL-safe ID from a calendar/era name
	 */
	private generateId(name: string): string {
		return name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '_')
			.replace(/^_|_$/g, '');
	}

	/**
	 * Parse a date string using Calendarium's parser
	 */
	parseDate(calendarName: string, dateString: string): CalendariumDate | null {
		const calApi = this.getCalendarAPI(calendarName);
		if (!calApi) {
			return null;
		}
		return calApi.parseDate(dateString);
	}

	/**
	 * Format a date using Calendarium's display format
	 */
	formatDate(calendarName: string, date: CalendariumDate): string | null {
		const calApi = this.getCalendarAPI(calendarName);
		if (!calApi) {
			return null;
		}
		return calApi.toDisplayDate(date);
	}

	/**
	 * Convert a CalendariumDate to an ISO-like date string for Charted Roots
	 * Handles 0-indexed months (Calendarium) to 1-indexed months (ISO)
	 *
	 * @param date CalendariumDate object with 0-indexed month
	 * @returns ISO-format date string (YYYY-MM-DD)
	 */
	calendariumDateToString(date: CalendariumDate): string {
		const year = date.year;
		// Convert from 0-indexed to 1-indexed month
		const month = (date.month + 1).toString().padStart(2, '0');
		const day = date.day.toString().padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	/**
	 * Parse Calendarium frontmatter date (fc-date or fc-start/fc-end)
	 * Handles both CalendariumDate objects and string dates
	 *
	 * fc-date can be either:
	 * - An object: { year: 2931, month: 2, day: 1 } (0-indexed month)
	 * - A string that Calendarium can parse
	 *
	 * @param fcDate The fc-date value from frontmatter
	 * @param calendarName The calendar name for string parsing
	 * @returns ISO-format date string or null
	 */
	parseFcDate(fcDate: unknown, calendarName?: string): string | null {
		if (!fcDate) {
			return null;
		}

		// If it's already a CalendariumDate object (most common case)
		if (typeof fcDate === 'object' && fcDate !== null) {
			const dateObj = fcDate as Record<string, unknown>;
			if (typeof dateObj.year === 'number' && typeof dateObj.month === 'number' && typeof dateObj.day === 'number') {
				return this.calendariumDateToString({
					year: dateObj.year,
					month: dateObj.month,
					day: dateObj.day
				});
			}
		}

		// If it's a string, try to parse it using Calendarium's parser
		if (typeof fcDate === 'string' && calendarName) {
			const parsed = this.parseDate(calendarName, fcDate);
			if (parsed) {
				return this.calendariumDateToString(parsed);
			}
		}

		// If it's already an ISO-like string, return it
		if (typeof fcDate === 'string') {
			return fcDate;
		}

		return null;
	}
}

/**
 * Singleton instance for global access
 */
let bridgeInstance: CalendariumBridge | null = null;

/**
 * Get or create the Calendarium bridge instance
 */
export function getCalendariumBridge(app: App): CalendariumBridge {
	if (!bridgeInstance) {
		bridgeInstance = new CalendariumBridge(app);
	}
	return bridgeInstance;
}

/**
 * Reset the bridge instance (useful for testing or plugin reload)
 */
export function resetCalendariumBridge(): void {
	bridgeInstance = null;
}
