/**
 * Date display utilities for formatting dates in the UI
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
	'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Format a date for user-friendly display, prettifying GEDCOM qualifiers
 *
 * Converts:
 * - ABT 1878 → "c. 1878"
 * - BEF 1950 → "before 1950"
 * - AFT 1880 → "after 1880"
 * - CAL 1945 → "c. 1945"
 * - EST 1880 → "c. 1880"
 * - BET 1882 AND 1885 → "1882–1885"
 * - Partial dates (1855-03) → "Mar 1855"
 * - Full ISO dates (1855-03-15) → "15 Mar 1855"
 */
export function formatDisplayDate(dateStr: string | undefined): string {
	if (!dateStr) return '';

	const trimmed = dateStr.trim();

	// Handle BET X AND Y ranges → "X–Y"
	const betMatch = trimmed.match(/^BET\s+(\d{4})\s+AND\s+(\d{4})$/i);
	if (betMatch) {
		return `${betMatch[1]}–${betMatch[2]}`;
	}

	// Handle qualifiers with year only (ABT 1878 → "c. 1878")
	const qualifierYearMatch = trimmed.match(/^(ABT|BEF|AFT|CAL|EST)\s+(\d{4})$/i);
	if (qualifierYearMatch) {
		const qualifier = qualifierYearMatch[1].toUpperCase();
		const year = qualifierYearMatch[2];
		switch (qualifier) {
			case 'ABT':
			case 'CAL':
			case 'EST':
				return `c. ${year}`;
			case 'BEF':
				return `before ${year}`;
			case 'AFT':
				return `after ${year}`;
		}
	}

	// Handle qualifiers with ISO partial date (ABT 1855-03 → "c. Mar 1855")
	const qualifierPartialMatch = trimmed.match(/^(ABT|BEF|AFT|CAL|EST)\s+(\d{4})-(\d{2})$/i);
	if (qualifierPartialMatch) {
		const qualifier = qualifierPartialMatch[1].toUpperCase();
		const year = qualifierPartialMatch[2];
		const monthIdx = parseInt(qualifierPartialMatch[3], 10) - 1;
		const formattedDate = `${MONTHS[monthIdx]} ${year}`;
		switch (qualifier) {
			case 'ABT':
			case 'CAL':
			case 'EST':
				return `c. ${formattedDate}`;
			case 'BEF':
				return `before ${formattedDate}`;
			case 'AFT':
				return `after ${formattedDate}`;
		}
	}

	// Convert ISO to readable format (YYYY-MM-DD → "D Mon YYYY")
	const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
	if (isoMatch) {
		const year = isoMatch[1];
		const monthIdx = parseInt(isoMatch[2], 10) - 1;
		const day = parseInt(isoMatch[3], 10);
		return `${day} ${MONTHS[monthIdx]} ${year}`;
	}

	// Year-month only (YYYY-MM → "Mon YYYY")
	const yearMonthMatch = trimmed.match(/^(\d{4})-(\d{2})$/);
	if (yearMonthMatch) {
		const year = yearMonthMatch[1];
		const monthIdx = parseInt(yearMonthMatch[2], 10) - 1;
		return `${MONTHS[monthIdx]} ${year}`;
	}

	// Return as-is for year-only, GEDCOM-like format, or unrecognized
	return trimmed;
}
