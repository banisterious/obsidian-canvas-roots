/**
 * GEDCOM Preprocessor for MyHeritage Compatibility
 *
 * Automatically detects and fixes common issues in MyHeritage GEDCOM exports:
 * - UTF-8 BOM (Byte Order Mark) removal
 * - Double-encoded HTML entities (e.g., &amp;lt;br&amp;gt;)
 * - Single-encoded HTML entities mixed in same records
 * - <br> tag conversion to newlines
 * - Decorative HTML tag stripping
 *
 * @see https://github.com/banisterious/obsidian-charted-roots/issues/144
 */

import { getLogger } from '../core/logging';

const logger = getLogger('GedcomPreprocessor');

/**
 * Detection results from analyzing GEDCOM content
 */
export interface PreprocessorDetection {
	hasUtf8Bom: boolean;
	isMyHeritage: boolean;
	hasDoubleEncodedEntities: boolean;
	shouldPreprocess: boolean;
}

/**
 * Result of preprocessing a GEDCOM file
 */
export interface PreprocessResult {
	content: string;
	wasPreprocessed: boolean;
	fixes: {
		bomRemoved: boolean;
		concFieldsNormalized: number;
		detectionInfo: PreprocessorDetection;
	};
}

/**
 * GEDCOM compatibility mode setting values
 */
export type GedcomCompatibilityMode = 'auto' | 'myheritage' | 'none';

/**
 * Detect if content is from MyHeritage and needs preprocessing
 */
export function detectMyHeritage(content: string): PreprocessorDetection {
	// Check for UTF-8 BOM
	const hasUtf8Bom = content.charCodeAt(0) === 0xFEFF ||
		(content.charCodeAt(0) === 0xEF &&
		 content.charCodeAt(1) === 0xBB &&
		 content.charCodeAt(2) === 0xBF);

	// Check for MyHeritage source tag (uppercase "MYHERITAGE" per real samples)
	// Check first 2000 chars to find header section
	const isMyHeritage = /1\s+SOUR\s+MYHERITAGE/i.test(content.substring(0, 2000));

	// Check for double-encoded entities (sample first 50KB for performance)
	// Includes &amp;nbsp; which appears in MyHeritage exports
	const sample = content.substring(0, 50000);
	const hasDoubleEncodedEntities = /&amp;(?:lt|gt|amp|quot|nbsp);/i.test(sample);

	return {
		hasUtf8Bom,
		isMyHeritage,
		hasDoubleEncodedEntities,
		shouldPreprocess: hasUtf8Bom || (isMyHeritage && hasDoubleEncodedEntities)
	};
}

/**
 * Strip UTF-8 BOM from content if present
 */
export function stripUtf8Bom(content: string): { content: string; fixed: boolean } {
	// Handle BOM as Unicode character U+FEFF
	if (content.charCodeAt(0) === 0xFEFF) {
		return { content: content.substring(1), fixed: true };
	}

	// Handle BOM as raw bytes (if reading as binary)
	if (content.charCodeAt(0) === 0xEF &&
		content.charCodeAt(1) === 0xBB &&
		content.charCodeAt(2) === 0xBF) {
		return { content: content.substring(3), fixed: true };
	}

	return { content, fixed: false };
}

/**
 * Decode common HTML entities to their character equivalents
 */
function decodeHtmlEntities(text: string): string {
	const entities: Record<string, string> = {
		'&lt;': '<',
		'&gt;': '>',
		'&amp;': '&',
		'&quot;': '"',
		'&apos;': "'",
		'&#39;': "'",
		'&nbsp;': ' '  // Non-breaking space -> regular space
	};

	let result = text;

	// Replace named entities (case-insensitive)
	for (const [entity, char] of Object.entries(entities)) {
		result = result.replace(new RegExp(entity, 'gi'), char);
	}

	// Replace numeric entities (&#60; or &#x3C;)
	result = result.replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num)));
	result = result.replace(/&#x([0-9a-fA-F]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

	return result;
}

/**
 * Repair HTML entities in text content
 * Handles:
 * - Double-encoded entities (&amp;lt; -> <)
 * - Single-encoded entities (&lt; -> <)
 * - <br> tag conversion to newlines
 * - Decorative HTML tag stripping
 * - Embedded newline cleanup
 */
export function repairHtmlEntities(text: string): { content: string; fixed: boolean } {
	let fixed = false;
	let result = text;

	// Note: Split entity repair not needed per real-world sample analysis.
	// MyHeritage splits at word boundaries, not mid-entity.

	// Step 1: Decode double-encoded entities
	// &amp;lt; -> &lt; -> <
	// &amp;gt; -> &gt; -> >
	// &amp;amp; -> &amp; -> &
	// &amp;quot; -> &quot; -> "
	// &amp;nbsp; -> &nbsp; -> (non-breaking space)
	const doubleEncodedPattern = /&amp;(lt|gt|amp|quot|nbsp|#\d+|#x[0-9a-fA-F]+);/gi;
	if (doubleEncodedPattern.test(result)) {
		fixed = true;
		// Reset lastIndex since we used test() with /g flag
		doubleEncodedPattern.lastIndex = 0;
		// First decode: &amp;lt; -> &lt;
		result = result.replace(doubleEncodedPattern, '&$1;');
		// Second decode: &lt; -> <
		result = decodeHtmlEntities(result);
	}

	// Step 2: Decode single-encoded entities (also present in MyHeritage exports)
	// These appear mixed with double-encoded in the same record
	if (/&(?:lt|gt|nbsp);/i.test(result)) {
		fixed = true;
		result = decodeHtmlEntities(result);
	}

	// Step 3: Convert <br> tags to spaces
	// Note: We use spaces instead of newlines because newlines mid-line would
	// create invalid GEDCOM (lines without level numbers). The data ends up in
	// source citations where exact formatting isn't critical.
	// Handles: <br>, <br/>, <br />, <BR />, etc.
	if (/<br\s*\/?>/i.test(result)) {
		fixed = true;
		result = result.replace(/<br\s*\/?>/gi, ' ');
	}

	// Step 4: Strip decorative HTML tags that don't add meaning
	// <a>text</a> (without href) -> text
	if (/<a>([^<]*)<\/a>/i.test(result)) {
		fixed = true;
		result = result.replace(/<a>([^<]*)<\/a>/gi, '$1');
	}

	// Step 5: Remove embedded escaped newlines (violate GEDCOM spec)
	if (/\\n|\\r\\n|\\r/.test(result)) {
		fixed = true;
		result = result.replace(/\\r\\n|\\n|\\r/g, ' ');
	}

	return { content: result, fixed };
}

/**
 * Normalize CONC continuation fields
 * Joins CONC lines and repairs any entity issues in the combined content
 */
export function normalizeConcFields(content: string): { content: string; fixCount: number } {
	const lines = content.split(/\r?\n/);
	const fixed: string[] = [];
	let fixCount = 0;
	let i = 0;

	while (i < lines.length) {
		const line = lines[i];

		// Check if this is a line followed by CONC continuations
		if (i + 1 < lines.length && /^\s*\d+\s+CONC\s/.test(lines[i + 1])) {
			// Extract the level number from the current line
			const levelMatch = line.match(/^\s*(\d+)/);
			if (levelMatch) {
				const baseLevel = parseInt(levelMatch[1]);
				const concLevel = baseLevel + 1;
				const concRegex = new RegExp(`^\\s*${concLevel}\\s+CONC\\s?(.*)$`);

				let accumulated = line;
				let j = i + 1;

				while (j < lines.length && concRegex.test(lines[j])) {
					const match = lines[j].match(concRegex);
					if (match) {
						// CONC means concatenate WITHOUT space (per GEDCOM spec)
						accumulated += match[1];
					}
					j++;
				}

				// Now process the accumulated content for HTML entity issues
				const processed = repairHtmlEntities(accumulated);
				if (processed.fixed) {
					fixCount++;
				}
				fixed.push(processed.content);

				i = j; // Skip past all CONC lines
				continue;
			}
		}

		// Not a CONC situation, but still check for entity issues in regular lines
		// This handles DATA/TEXT fields that may have entities without CONC
		if (/&amp;|&lt;|&gt;|&nbsp;|<br/i.test(line)) {
			const processed = repairHtmlEntities(line);
			if (processed.fixed) {
				fixCount++;
			}
			fixed.push(processed.content);
		} else {
			fixed.push(line);
		}
		i++;
	}

	return {
		content: fixed.join('\n'),
		fixCount
	};
}

/**
 * Main preprocessing function
 * Orchestrates all fixes based on compatibility mode setting
 */
export function preprocessGedcom(
	content: string,
	mode: GedcomCompatibilityMode
): PreprocessResult {

	// Skip if disabled
	if (mode === 'none') {
		return {
			content,
			wasPreprocessed: false,
			fixes: {
				bomRemoved: false,
				concFieldsNormalized: 0,
				detectionInfo: {
					hasUtf8Bom: false,
					isMyHeritage: false,
					hasDoubleEncodedEntities: false,
					shouldPreprocess: false
				}
			}
		};
	}

	// Detect issues
	const detection = detectMyHeritage(content);

	// Should we preprocess?
	const shouldPreprocess = mode === 'myheritage' ||
		(mode === 'auto' && detection.shouldPreprocess);

	if (!shouldPreprocess) {
		logger.debug('preprocessGedcom', 'No preprocessing needed', {
			mode,
			detection
		});
		return {
			content,
			wasPreprocessed: false,
			fixes: {
				bomRemoved: false,
				concFieldsNormalized: 0,
				detectionInfo: detection
			}
		};
	}

	logger.info('preprocessGedcom', 'Applying MyHeritage compatibility fixes', {
		mode,
		isMyHeritage: detection.isMyHeritage,
		hasUtf8Bom: detection.hasUtf8Bom,
		hasDoubleEncodedEntities: detection.hasDoubleEncodedEntities
	});

	// Apply fixes
	let processed = content;

	// Fix 1: Strip UTF-8 BOM
	const bomResult = stripUtf8Bom(processed);
	processed = bomResult.content;

	// Fix 2: Normalize CONC fields and repair HTML entities
	const concResult = normalizeConcFields(processed);
	processed = concResult.content;

	logger.info('preprocessGedcom', 'Preprocessing complete', {
		bomRemoved: bomResult.fixed,
		concFieldsNormalized: concResult.fixCount
	});

	return {
		content: processed,
		wasPreprocessed: true,
		fixes: {
			bomRemoved: bomResult.fixed,
			concFieldsNormalized: concResult.fixCount,
			detectionInfo: detection
		}
	};
}
