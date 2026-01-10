/**
 * UUID generation utilities for Charted Roots
 * Implements the cr_id format: abc-123-def-456
 */

/**
 * Generate a random cr_id in the format: abc-123-def-456
 *
 * Format breakdown:
 * - Three lowercase letters
 * - Hyphen
 * - Three digits
 * - Hyphen
 * - Three lowercase letters
 * - Hyphen
 * - Three digits
 *
 * @returns A unique cr_id string
 *
 * @example
 * generateCrId() // => "abc-123-def-456"
 */
export function generateCrId(): string {
	const letters1 = randomLetters(3);
	const digits1 = randomDigits(3);
	const letters2 = randomLetters(3);
	const digits2 = randomDigits(3);

	return `${letters1}-${digits1}-${letters2}-${digits2}`;
}

/**
 * Generate random lowercase letters
 *
 * @param count - Number of letters to generate
 * @returns Random lowercase letters
 */
function randomLetters(count: number): string {
	const chars = 'abcdefghijklmnopqrstuvwxyz';
	let result = '';

	for (let i = 0; i < count; i++) {
		result += chars.charAt(Math.floor(Math.random() * chars.length));
	}

	return result;
}

/**
 * Generate random digits
 *
 * @param count - Number of digits to generate
 * @returns Random digits as a string
 */
function randomDigits(count: number): string {
	let result = '';

	for (let i = 0; i < count; i++) {
		result += Math.floor(Math.random() * 10);
	}

	return result;
}

/**
 * Validate a cr_id string format
 *
 * @param crId - The cr_id string to validate
 * @returns True if the format is valid
 *
 * @example
 * validateCrId("abc-123-def-456") // => true
 * validateCrId("invalid") // => false
 */
export function validateCrId(crId: string): boolean {
	const pattern = /^[a-z]{3}-\d{3}-[a-z]{3}-\d{3}$/;
	return pattern.test(crId);
}
