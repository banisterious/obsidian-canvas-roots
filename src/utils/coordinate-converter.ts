/**
 * Coordinate Converter Utility
 *
 * Parses DMS (degrees, minutes, seconds) coordinates and converts to decimal degrees.
 * Supports various input formats:
 * - Symbol notation: 33°51'08"N, 83°37'06"W
 * - Space-separated: 33 51 08 N
 * - Hyphen-separated: 33-51-08-N
 * - Direction prefix: N 33 51 08
 * - Signed decimal: +33.8522, -83.6183
 * - Plain decimal: 33.8522 (pass-through)
 */

/**
 * Result of parsing a coordinate input
 */
export interface CoordinateParseResult {
	/** Decimal degrees value */
	decimal: number;
	/** Whether the input was in DMS format (vs decimal pass-through) */
	isDMS: boolean;
}

/**
 * Cardinal direction indicators
 */
type CardinalDirection = 'N' | 'S' | 'E' | 'W';

/**
 * Check if a character is a direction indicator
 */
function isDirectionChar(char: string): char is CardinalDirection {
	return ['N', 'S', 'E', 'W'].includes(char.toUpperCase());
}

/**
 * Get the sign multiplier for a direction
 * South and West are negative
 */
function getDirectionSign(direction: CardinalDirection): number {
	return direction === 'S' || direction === 'W' ? -1 : 1;
}

/**
 * Normalize various degree symbols to standard degree sign
 * Handles: ° (degree sign), o (letter o), º (masculine ordinal)
 */
function normalizeDegreeSymbol(input: string): string {
	return input.replace(/[oº]/g, '°');
}

/**
 * Parse a DMS coordinate string and convert to decimal degrees.
 *
 * Supported formats:
 * - 33°51'08"N or 33°51'08"S (symbol notation with direction)
 * - 33°51'08" (symbol notation without direction, assumes positive)
 * - 33 51 08 N (space-separated)
 * - 33-51-08-N (hyphen-separated)
 * - N 33 51 08 (direction prefix)
 * - 33.8522 (decimal pass-through)
 * - +33.8522 or -83.6183 (signed decimal)
 * - -33°51'08" (negative DMS)
 *
 * @param input The coordinate string to parse
 * @returns Parse result with decimal value, or null if parsing failed
 */
export function parseDMSCoordinate(input: string): CoordinateParseResult | null {
	if (!input || typeof input !== 'string') {
		return null;
	}

	// Trim and normalize
	let trimmed = input.trim();
	if (!trimmed) {
		return null;
	}

	// Normalize degree symbols (o, º → °)
	trimmed = normalizeDegreeSymbol(trimmed);

	// Check for plain decimal (including signed)
	// Match: optional sign, digits, decimal point, digits
	const plainDecimalMatch = trimmed.match(/^([+-]?\d+\.?\d*)$/);
	if (plainDecimalMatch) {
		const value = parseFloat(plainDecimalMatch[1]);
		if (!isNaN(value)) {
			return { decimal: value, isDMS: false };
		}
	}

	// Extract direction if present (at start or end)
	let direction: CardinalDirection | null = null;
	let isNegative = false;

	// Check for leading negative sign
	if (trimmed.startsWith('-')) {
		isNegative = true;
		trimmed = trimmed.substring(1).trim();
	} else if (trimmed.startsWith('+')) {
		trimmed = trimmed.substring(1).trim();
	}

	// Check for direction at start (e.g., "N 33 51 08")
	const dirPrefixMatch = trimmed.match(/^([NSEW])\s+(.+)$/i);
	if (dirPrefixMatch) {
		direction = dirPrefixMatch[1].toUpperCase() as CardinalDirection;
		trimmed = dirPrefixMatch[2].trim();
	}

	// Check for direction at end (e.g., "33 51 08 N" or "33°51'08"N" or "33-51-08-N")
	const dirSuffixMatch = trimmed.match(/^(.+?)[\s-]*([NSEW])$/i);
	if (dirSuffixMatch && !direction) {
		direction = dirSuffixMatch[2].toUpperCase() as CardinalDirection;
		// Remove trailing hyphen if present
		trimmed = dirSuffixMatch[1].trim().replace(/-$/, '');
	}

	// Now parse the DMS components
	// Pattern 1: Symbol notation - 33°51'08" or 33°51'8.5"
	const symbolMatch = trimmed.match(
		/^(\d+(?:\.\d+)?)\s*°\s*(?:(\d+(?:\.\d+)?)\s*['′]\s*)?(?:(\d+(?:\.\d+)?)\s*["″]?\s*)?$/
	);

	// Pattern 2: Space-separated - 33 51 08 or 33 51 8.5
	const spaceMatch = trimmed.match(
		/^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)$/
	);

	// Pattern 3: Hyphen-separated - 33-51-08 or 33-51-8.5
	const hyphenMatch = trimmed.match(
		/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/
	);

	// Pattern 4: Degrees and decimal minutes - 33°51.133' or 33 51.133
	const degMinMatch = trimmed.match(
		/^(\d+(?:\.\d+)?)\s*°?\s*(\d+(?:\.\d+)?)\s*['′]?$/
	);

	let degrees: number;
	let minutes = 0;
	let seconds = 0;

	if (symbolMatch) {
		degrees = parseFloat(symbolMatch[1]);
		minutes = symbolMatch[2] ? parseFloat(symbolMatch[2]) : 0;
		seconds = symbolMatch[3] ? parseFloat(symbolMatch[3]) : 0;
	} else if (spaceMatch) {
		degrees = parseFloat(spaceMatch[1]);
		minutes = parseFloat(spaceMatch[2]);
		seconds = parseFloat(spaceMatch[3]);
	} else if (hyphenMatch) {
		degrees = parseFloat(hyphenMatch[1]);
		minutes = parseFloat(hyphenMatch[2]);
		seconds = parseFloat(hyphenMatch[3]);
	} else if (degMinMatch) {
		degrees = parseFloat(degMinMatch[1]);
		minutes = parseFloat(degMinMatch[2]);
		seconds = 0;
	} else {
		// Could not parse as DMS
		return null;
	}

	// Validate component ranges
	if (isNaN(degrees) || degrees < 0) {
		return null;
	}
	if (isNaN(minutes) || minutes < 0 || minutes >= 60) {
		return null;
	}
	if (isNaN(seconds) || seconds < 0 || seconds >= 60) {
		return null;
	}

	// Convert to decimal degrees: DD = D + M/60 + S/3600
	let decimal = degrees + minutes / 60 + seconds / 3600;

	// Apply direction sign
	if (direction) {
		decimal *= getDirectionSign(direction);
	}

	// Apply negative sign if present
	if (isNegative) {
		decimal *= -1;
	}

	return { decimal, isDMS: true };
}

/**
 * Parse a latitude coordinate string.
 * Validates that the result is within -90 to 90.
 *
 * @param input The latitude string to parse
 * @returns Decimal degrees value, or null if invalid
 */
export function parseLatitude(input: string): number | null {
	const result = parseDMSCoordinate(input);
	if (!result) {
		return null;
	}

	// Validate latitude range
	if (result.decimal < -90 || result.decimal > 90) {
		return null;
	}

	return result.decimal;
}

/**
 * Parse a longitude coordinate string.
 * Validates that the result is within -180 to 180.
 *
 * @param input The longitude string to parse
 * @returns Decimal degrees value, or null if invalid
 */
export function parseLongitude(input: string): number | null {
	const result = parseDMSCoordinate(input);
	if (!result) {
		return null;
	}

	// Validate longitude range
	if (result.decimal < -180 || result.decimal > 180) {
		return null;
	}

	return result.decimal;
}

/**
 * Format a decimal degrees value as a string.
 *
 * @param value The decimal degrees value
 * @param precision Number of decimal places (default: 6)
 * @returns Formatted string
 */
export function formatDecimal(value: number, precision = 6): string {
	return value.toFixed(precision);
}

/**
 * Check if a string appears to be in DMS format.
 * Useful for determining whether to show conversion preview.
 *
 * @param input The string to check
 * @returns true if the input appears to be DMS format
 */
export function isDMSFormat(input: string): boolean {
	if (!input || typeof input !== 'string') {
		return false;
	}

	const trimmed = input.trim();

	// Check for degree symbols or direction letters
	if (/[°′″'"]/.test(trimmed)) {
		return true;
	}

	// Check for direction indicator at start or end
	if (/^[NSEW]\s/i.test(trimmed) || /\s[NSEW]$/i.test(trimmed)) {
		return true;
	}

	// Check for space-separated or hyphen-separated DMS pattern
	// (three numeric groups with spaces or hyphens)
	if (/^\d+[\s-]\d+[\s-]\d+/.test(trimmed)) {
		return true;
	}

	return false;
}
