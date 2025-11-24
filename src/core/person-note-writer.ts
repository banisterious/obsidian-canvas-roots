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
	birthPlace?: string;
	deathPlace?: string;
	occupation?: string;
	gender?: string;
	father?: string;        // Legacy: name-based relationship (deprecated)
	mother?: string;        // Legacy: name-based relationship (deprecated)
	spouse?: string[];      // Legacy: name-based relationship (deprecated)
	fatherCrId?: string;    // Father's cr_id for reliable resolution
	fatherName?: string;    // Father's name for wikilink display
	motherCrId?: string;    // Mother's cr_id for reliable resolution
	motherName?: string;    // Mother's name for wikilink display
	spouseCrId?: string[];  // Spouse(s) cr_id for reliable resolution
	spouseName?: string[];  // Spouse(s) name for wikilink display
	childCrId?: string[];   // Children's cr_ids for reliable resolution
	childName?: string[];   // Children's names for wikilink display
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

	// Build frontmatter with essential properties
	// Essential properties are always included (per Guide documentation)
	const frontmatter: Record<string, any> = {
		cr_id: crId,
		name: person.name || '',
		born: person.birthDate || '',
		died: person.deathDate || ''
	};

	if (person.birthPlace) {
		frontmatter.birth_place = person.birthPlace;
	}

	if (person.deathPlace) {
		frontmatter.death_place = person.deathPlace;
	}

	if (person.occupation) {
		frontmatter.occupation = person.occupation;
	}

	if (person.gender) {
		frontmatter.gender = person.gender;
	}

	// Handle relationships using dual storage: wikilinks for Obsidian + _id fields for reliability
	logger.debug('relationships', `Processing - fatherCrId: ${person.fatherCrId}, motherCrId: ${person.motherCrId}, spouseCrId: ${person.spouseCrId}`);

	// Father relationship (dual storage)
	if (person.fatherCrId && person.fatherName) {
		frontmatter.father = `"[[${person.fatherName}]]"`;
		frontmatter.father_id = person.fatherCrId;
		logger.debug('father', `Added (dual): wikilink=${person.fatherName}, id=${person.fatherCrId}`);
	} else if (person.fatherCrId) {
		// ID only (fallback for legacy data)
		frontmatter.father_id = person.fatherCrId;
		logger.debug('father', `Added (id only): ${person.fatherCrId}`);
	} else if (person.father) {
		// Legacy: name-based relationship only
		frontmatter.father = `"[[${person.father}]]"`;
		logger.debug('father', `Added (legacy): ${person.father}`);
	}

	// Mother relationship (dual storage)
	if (person.motherCrId && person.motherName) {
		frontmatter.mother = `"[[${person.motherName}]]"`;
		frontmatter.mother_id = person.motherCrId;
		logger.debug('mother', `Added (dual): wikilink=${person.motherName}, id=${person.motherCrId}`);
	} else if (person.motherCrId) {
		// ID only (fallback for legacy data)
		frontmatter.mother_id = person.motherCrId;
		logger.debug('mother', `Added (id only): ${person.motherCrId}`);
	} else if (person.mother) {
		// Legacy: name-based relationship only
		frontmatter.mother = `"[[${person.mother}]]"`;
		logger.debug('mother', `Added (legacy): ${person.mother}`);
	}

	// Spouse relationship(s) (dual storage)
	if (person.spouseCrId && person.spouseCrId.length > 0) {
		if (person.spouseName && person.spouseName.length === person.spouseCrId.length) {
			// Dual storage with both names and IDs
			if (person.spouseName.length === 1) {
				frontmatter.spouse = `"[[${person.spouseName[0]}]]"`;
				frontmatter.spouse_id = person.spouseCrId[0];
			} else {
				frontmatter.spouse = person.spouseName.map(s => `"[[${s}]]"`);
				frontmatter.spouse_id = person.spouseCrId;
			}
			logger.debug('spouse', `Added (dual): wikilinks=${JSON.stringify(person.spouseName)}, ids=${JSON.stringify(person.spouseCrId)}`);
		} else {
			// ID only (fallback for legacy data or missing names)
			if (person.spouseCrId.length === 1) {
				frontmatter.spouse_id = person.spouseCrId[0];
			} else {
				frontmatter.spouse_id = person.spouseCrId;
			}
			logger.debug('spouse', `Added (id only): ${JSON.stringify(person.spouseCrId)}`);
		}
	} else if (person.spouse && person.spouse.length > 0) {
		// Legacy: name-based relationship only
		if (person.spouse.length === 1) {
			frontmatter.spouse = `"[[${person.spouse[0]}]]"`;
		} else {
			frontmatter.spouse = person.spouse.map(s => `"[[${s}]]"`);
		}
		logger.debug('spouse', `Added (legacy): ${JSON.stringify(person.spouse)}`);
	}

	// Children relationship(s) (dual storage)
	if (person.childCrId && person.childCrId.length > 0) {
		if (person.childName && person.childName.length === person.childCrId.length) {
			// Dual storage with both names and IDs
			if (person.childName.length === 1) {
				frontmatter.child = `"[[${person.childName[0]}]]"`;
				frontmatter.children_id = person.childCrId[0];
			} else {
				frontmatter.child = person.childName.map(c => `"[[${c}]]"`);
				frontmatter.children_id = person.childCrId;
			}
			logger.debug('children', `Added (dual): wikilinks=${JSON.stringify(person.childName)}, ids=${JSON.stringify(person.childCrId)}`);
		} else {
			// ID only (fallback for legacy data or missing names)
			if (person.childCrId.length === 1) {
				frontmatter.children_id = person.childCrId[0];
			} else {
				frontmatter.children_id = person.childCrId;
			}
			logger.debug('children', `Added (id only): ${JSON.stringify(person.childCrId)}`);
		}
	}

	// Ensure all essential properties are present (even if empty)
	// This matches the "Add essential properties" feature expectations
	if (!('father' in frontmatter) && !('father_id' in frontmatter)) {
		frontmatter.father = '';
	}
	if (!('mother' in frontmatter) && !('mother_id' in frontmatter)) {
		frontmatter.mother = '';
	}
	if (!('spouse' in frontmatter) && !('spouse_id' in frontmatter)) {
		frontmatter.spouses = [];
	}
	if (!('children' in frontmatter) && !('children_id' in frontmatter)) {
		frontmatter.children = [];
	}
	if (!('group_name' in frontmatter)) {
		frontmatter.group_name = '';
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
