/**
 * Person note writer utilities for Canvas Roots
 * Creates person notes with proper YAML frontmatter
 */

import { App, TFile, normalizePath } from 'obsidian';
import { generateCrId } from './uuid';
import { getLogger } from './logging';

const logger = getLogger('PersonNoteWriter');

/**
 * Person data for note creation
 */
export interface PersonData {
	name: string;
	crId?: string;
	birthDate?: string;
	deathDate?: string;
	father?: string;        // Legacy: name-based relationship (deprecated)
	mother?: string;        // Legacy: name-based relationship (deprecated)
	spouse?: string[];      // Legacy: name-based relationship (deprecated)
	fatherCrId?: string;    // Preferred: cr_id-based relationship
	motherCrId?: string;    // Preferred: cr_id-based relationship
	spouseCrId?: string[];  // Preferred: cr_id-based relationship
}

/**
 * Options for person note creation
 */
export interface CreatePersonNoteOptions {
	/** Directory path where person notes are stored (default: root) */
	directory?: string;
	/** Whether to open the note after creation (default: false) */
	openAfterCreate?: boolean;
	/** Whether to add bidirectional spouse links (default: true) */
	addBidirectionalLinks?: boolean;
}

/**
 * Create a person note with YAML frontmatter
 *
 * @param app - Obsidian app instance
 * @param person - Person data
 * @param options - Creation options
 * @returns The created TFile
 *
 * @example
 * const file = await createPersonNote(app, {
 *   name: "John Robert Smith",
 *   birthDate: "1888-05-15",
 *   deathDate: "1952-08-20"
 * }, {
 *   directory: "People",
 *   openAfterCreate: true
 * });
 */
export async function createPersonNote(
	app: App,
	person: PersonData,
	options: CreatePersonNoteOptions = {}
): Promise<TFile> {
	const { directory = '', openAfterCreate = false, addBidirectionalLinks = true } = options;

	// Generate cr_id if not provided
	const crId = person.crId || generateCrId();

	// Build frontmatter
	const frontmatter: Record<string, any> = {
		cr_id: crId
	};

	// Add optional fields
	if (person.name) {
		frontmatter.name = person.name;
	}

	if (person.birthDate) {
		frontmatter.born = person.birthDate;
	}

	if (person.deathDate) {
		frontmatter.died = person.deathDate;
	}

	// Handle relationships - prefer cr_id-based over name-based
	logger.debug('relationships', `Processing - fatherCrId: ${person.fatherCrId}, motherCrId: ${person.motherCrId}, spouseCrId: ${person.spouseCrId}`);

	if (person.fatherCrId) {
		frontmatter.father = person.fatherCrId;
		logger.debug('father', `Added: ${person.fatherCrId}`);
	} else if (person.father) {
		// Legacy: name-based relationship
		frontmatter.father = `"[[${person.father}]]"`;
		logger.debug('father', `Added (legacy): ${person.father}`);
	}

	if (person.motherCrId) {
		frontmatter.mother = person.motherCrId;
		logger.debug('mother', `Added: ${person.motherCrId}`);
	} else if (person.mother) {
		// Legacy: name-based relationship
		frontmatter.mother = `"[[${person.mother}]]"`;
		logger.debug('mother', `Added (legacy): ${person.mother}`);
	}

	if (person.spouseCrId && person.spouseCrId.length > 0) {
		if (person.spouseCrId.length === 1) {
			frontmatter.spouse = person.spouseCrId[0];
		} else {
			frontmatter.spouse = person.spouseCrId;
		}
		logger.debug('spouse', `Added: ${JSON.stringify(person.spouseCrId)}`);
	} else if (person.spouse && person.spouse.length > 0) {
		// Legacy: name-based relationship
		if (person.spouse.length === 1) {
			frontmatter.spouse = `"[[${person.spouse[0]}]]"`;
		} else {
			frontmatter.spouse = person.spouse.map(s => `"[[${s}]]"`);
		}
		logger.debug('spouse', `Added (legacy): ${JSON.stringify(person.spouse)}`);
	}

	logger.debug('frontmatter', `Final: ${JSON.stringify(frontmatter)}`);

	// Build YAML frontmatter string
	const yamlLines = ['---'];
	for (const [key, value] of Object.entries(frontmatter)) {
		if (Array.isArray(value)) {
			yamlLines.push(`${key}:`);
			for (const item of value) {
				yamlLines.push(`  - ${item}`);
			}
		} else {
			yamlLines.push(`${key}: ${value}`);
		}
	}
	yamlLines.push('---');

	// Build note content
	const noteContent = [
		...yamlLines,
		'',
		'# Research Notes',
		'',
		'',
		''
	].join('\n');

	// Sanitize filename (remove invalid characters)
	const filename = sanitizeFilename(person.name || 'Untitled Person');

	// Build full path
	const fullPath = directory
		? normalizePath(`${directory}/${filename}.md`)
		: normalizePath(`${filename}.md`);

	// Check if file already exists
	let finalPath = fullPath;
	let counter = 1;
	while (app.vault.getAbstractFileByPath(finalPath)) {
		const baseName = filename;
		const newFilename = `${baseName} ${counter}`;
		finalPath = directory
			? normalizePath(`${directory}/${newFilename}.md`)
			: normalizePath(`${newFilename}.md`);
		counter++;
	}

	// Create the file
	const file = await app.vault.create(finalPath, noteContent);

	// Handle bidirectional spouse linking
	if (addBidirectionalLinks && person.spouseCrId && person.spouseCrId.length > 0) {
		for (const spouseCrId of person.spouseCrId) {
			await addBidirectionalSpouseLink(app, spouseCrId, crId, directory);
		}
	}

	// Open the file if requested
	if (openAfterCreate) {
		const leaf = app.workspace.getLeaf(false);
		await leaf.openFile(file);
	}

	return file;
}

/**
 * Add bidirectional spouse link to an existing person note
 *
 * @param app - Obsidian app instance
 * @param spouseCrId - The cr_id of the spouse to update
 * @param newSpouseCrId - The cr_id of the new spouse to add
 * @param directory - Directory to search for the spouse file
 */
async function addBidirectionalSpouseLink(
	app: App,
	spouseCrId: string,
	newSpouseCrId: string,
	directory: string
): Promise<void> {
	logger.debug('bidirectional-link', `Adding spouse link: ${newSpouseCrId} to person ${spouseCrId}`);

	// Find the spouse's file by cr_id
	const files = app.vault.getMarkdownFiles();
	let spouseFile: TFile | null = null;

	for (const file of files) {
		// Only check files in the specified directory (or root if no directory)
		if (directory && !file.path.startsWith(directory)) {
			continue;
		}

		const cache = app.metadataCache.getFileCache(file);
		if (cache?.frontmatter?.cr_id === spouseCrId) {
			spouseFile = file;
			break;
		}
	}

	if (!spouseFile) {
		logger.warn('bidirectional-link', `Could not find spouse file with cr_id: ${spouseCrId}`);
		return;
	}

	logger.debug('bidirectional-link', `Found spouse file: ${spouseFile.path}`);

	// Read the spouse's file content
	const content = await app.vault.read(spouseFile);

	// Parse frontmatter
	const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
	if (!frontmatterMatch) {
		logger.warn('bidirectional-link', `No frontmatter found in spouse file: ${spouseFile.path}`);
		return;
	}

	const frontmatterText = frontmatterMatch[1];
	const bodyContent = content.substring(frontmatterMatch[0].length);

	// Parse existing spouse values
	const spouseMatch = frontmatterText.match(/^spouse:\s*(.+)$/m);
	let spouseValues: string[] = [];

	if (spouseMatch) {
		const spouseValue = spouseMatch[1].trim();
		// Check if it's an array or single value
		if (frontmatterText.includes('spouse:\n')) {
			// Array format - extract all values
			const arrayMatches = frontmatterText.match(/^  - (.+)$/gm);
			if (arrayMatches) {
				spouseValues = arrayMatches.map(m => m.replace(/^  - /, '').trim());
			}
		} else {
			// Single value format
			spouseValues = [spouseValue];
		}
	}

	// Add new spouse if not already present
	if (!spouseValues.includes(newSpouseCrId)) {
		spouseValues.push(newSpouseCrId);
		logger.debug('bidirectional-link', `Adding ${newSpouseCrId} to spouse list: ${JSON.stringify(spouseValues)}`);

		// Rebuild frontmatter
		let newFrontmatterText = frontmatterText;

		// Remove old spouse field if it exists
		newFrontmatterText = newFrontmatterText.replace(/^spouse:.*$/gm, '');
		// Remove any spouse array items
		newFrontmatterText = newFrontmatterText.replace(/^  - [^\n]+$/gm, '');
		// Clean up extra blank lines
		newFrontmatterText = newFrontmatterText.replace(/\n\n+/g, '\n');

		// Add new spouse field
		if (spouseValues.length === 1) {
			// Single spouse - use simple format
			newFrontmatterText += `\nspouse: ${spouseValues[0]}`;
		} else {
			// Multiple spouses - use array format
			newFrontmatterText += '\nspouse:';
			for (const spouse of spouseValues) {
				newFrontmatterText += `\n  - ${spouse}`;
			}
		}

		// Rebuild file content
		const newContent = `---\n${newFrontmatterText}\n---${bodyContent}`;

		// Write back to file
		await app.vault.modify(spouseFile, newContent);
		logger.info('bidirectional-link', `Updated spouse link in ${spouseFile.path}`);
	} else {
		logger.debug('bidirectional-link', `Spouse ${newSpouseCrId} already linked in ${spouseFile.path}`);
	}
}

/**
 * Sanitize a filename by removing invalid characters
 *
 * @param filename - The filename to sanitize
 * @returns Sanitized filename
 */
function sanitizeFilename(filename: string): string {
	// Remove or replace invalid characters for file systems
	// Replace: \ / : * ? " < > |
	return filename
		.replace(/[\\/:*?"<>|]/g, '-')
		.replace(/\s+/g, ' ')
		.trim();
}
