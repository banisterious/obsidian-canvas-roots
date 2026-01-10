/**
 * Fictional Date Systems Module
 *
 * Provides support for custom calendar systems in fictional universes
 * and historical contexts (e.g., Middle-earth, Westeros, Star Wars).
 */

// Types
export type {
	FictionalEra,
	FictionalDateSystem,
	ParsedFictionalDate,
	DateParseResult,
	DateFormatOptions,
	AgeCalculation
} from './types/date-types';

// Parser
export { FictionalDateParser } from './parser/fictional-date-parser';

// Built-in Systems
export {
	MIDDLE_EARTH_CALENDAR,
	WESTEROS_CALENDAR,
	STAR_WARS_CALENDAR,
	GENERIC_FANTASY_CALENDAR,
	DEFAULT_DATE_SYSTEMS,
	getDefaultDateSystem,
	getDefaultDateSystemsForUniverse
} from './constants/default-date-systems';

// UI Components
export { createDateSystemsCard } from './ui/date-systems-card';
export { renderEventsTab } from './ui/events-tab';

// Services
export { DateService, createDateService } from './services/date-service';
export type { DateServiceSettings, ParsedDate } from './services/date-service';

// Utilities
export { formatDisplayDate } from './utils/date-display';
