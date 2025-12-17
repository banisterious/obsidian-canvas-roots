/**
 * Person note writer utilities for Canvas Roots
 * Creates person notes with proper YAML frontmatter
 */

import { App, TFile, normalizePath } from 'obsidian';
import { generateCrId } from './uuid';
import { getLogger } from './logging';

const logger = getLogger('PersonNoteWriter');

/**
 * Get the property name to write, respecting aliases
 * If user has an alias for this canonical property, return the user's property name
 */
function getWriteProperty(canonical: string, aliases: Record<string, string>): string {
	for (const [userProp, canonicalProp] of Object.entries(aliases)) {
		if (canonicalProp === canonical) {
			return userProp;
		}
	}
	return canonical;
}

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
	sex?: string;
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
	// Step-parent relationships
	stepfatherCrId?: string[];   // Step-father(s) cr_id
	stepfatherName?: string[];   // Step-father(s) name for wikilink display
	stepmotherCrId?: string[];   // Step-mother(s) cr_id
	stepmotherName?: string[];   // Step-mother(s) name for wikilink display
	// Adoptive parent relationships
	adoptiveFatherCrId?: string; // Adoptive father's cr_id
	adoptiveFatherName?: string; // Adoptive father's name for wikilink display
	adoptiveMotherCrId?: string; // Adoptive mother's cr_id
	adoptiveMotherName?: string; // Adoptive mother's name for wikilink display
}

/**
 * Filename format options
 */
export type FilenameFormat = 'original' | 'kebab-case' | 'snake_case';

/**
 * Dynamic block types that can be included in person notes
 */
export type DynamicBlockType = 'timeline' | 'relationships';

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
	/** Property aliases for writing custom property names (user property → canonical) */
	propertyAliases?: Record<string, string>;
	/** Filename format (default: 'original') */
	filenameFormat?: FilenameFormat;
	/** Include dynamic content blocks in the note body */
	includeDynamicBlocks?: boolean;
	/** Which dynamic block types to include (default: ['timeline', 'relationships']) */
	dynamicBlockTypes?: DynamicBlockType[];
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
	const {
		directory = '',
		openAfterCreate = false,
		addBidirectionalLinks = true,
		propertyAliases = {},
		filenameFormat = 'original',
		includeDynamicBlocks = false,
		dynamicBlockTypes = ['timeline', 'relationships']
	} = options;

	// Helper to get aliased property name
	const prop = (canonical: string) => getWriteProperty(canonical, propertyAliases);

	// Generate cr_id if not provided
	const crId = person.crId || generateCrId();

	// Build frontmatter with essential properties
	// Essential properties are always included (per Guide documentation)
	// Property names respect user-configured aliases
	const frontmatter: Record<string, string | string[]> = {
		[prop('cr_id')]: crId,
		[prop('cr_type')]: 'person',
		[prop('name')]: person.name || '',
		[prop('born')]: person.birthDate || '',
		[prop('died')]: person.deathDate || ''
	};

	if (person.birthPlace) {
		frontmatter[prop('birth_place')] = person.birthPlace;
	}

	if (person.deathPlace) {
		frontmatter[prop('death_place')] = person.deathPlace;
	}

	if (person.occupation) {
		frontmatter[prop('occupation')] = person.occupation;
	}

	if (person.sex) {
		frontmatter[prop('sex')] = person.sex;
	}

	// Handle relationships using dual storage: wikilinks for Obsidian + _id fields for reliability
	// Property names respect user-configured aliases
	logger.debug('relationships', `Processing - fatherCrId: ${person.fatherCrId}, motherCrId: ${person.motherCrId}, spouseCrId: ${person.spouseCrId?.join(', ') ?? 'none'}`);

	// Father relationship (dual storage)
	if (person.fatherCrId && person.fatherName) {
		frontmatter[prop('father')] = `"[[${person.fatherName}]]"`;
		frontmatter[prop('father_id')] = person.fatherCrId;
		logger.debug('father', `Added (dual): wikilink=${person.fatherName}, id=${person.fatherCrId}`);
	} else if (person.fatherCrId) {
		// ID only (fallback for legacy data)
		frontmatter[prop('father_id')] = person.fatherCrId;
		logger.debug('father', `Added (id only): ${person.fatherCrId}`);
	} else if (person.father) {
		// Legacy: name-based relationship only
		frontmatter[prop('father')] = `"[[${person.father}]]"`;
		logger.debug('father', `Added (legacy): ${person.father}`);
	}

	// Mother relationship (dual storage)
	if (person.motherCrId && person.motherName) {
		frontmatter[prop('mother')] = `"[[${person.motherName}]]"`;
		frontmatter[prop('mother_id')] = person.motherCrId;
		logger.debug('mother', `Added (dual): wikilink=${person.motherName}, id=${person.motherCrId}`);
	} else if (person.motherCrId) {
		// ID only (fallback for legacy data)
		frontmatter[prop('mother_id')] = person.motherCrId;
		logger.debug('mother', `Added (id only): ${person.motherCrId}`);
	} else if (person.mother) {
		// Legacy: name-based relationship only
		frontmatter[prop('mother')] = `"[[${person.mother}]]"`;
		logger.debug('mother', `Added (legacy): ${person.mother}`);
	}

	// Spouse relationship(s) (dual storage)
	if (person.spouseCrId && person.spouseCrId.length > 0) {
		if (person.spouseName && person.spouseName.length === person.spouseCrId.length) {
			// Dual storage with both names and IDs
			if (person.spouseName.length === 1) {
				frontmatter[prop('spouse')] = `"[[${person.spouseName[0]}]]"`;
				frontmatter[prop('spouse_id')] = person.spouseCrId[0];
			} else {
				frontmatter[prop('spouse')] = person.spouseName.map(s => `"[[${s}]]"`);
				frontmatter[prop('spouse_id')] = person.spouseCrId;
			}
			logger.debug('spouse', `Added (dual): wikilinks=${JSON.stringify(person.spouseName)}, ids=${JSON.stringify(person.spouseCrId)}`);
		} else {
			// ID only (fallback for legacy data or missing names)
			if (person.spouseCrId.length === 1) {
				frontmatter[prop('spouse_id')] = person.spouseCrId[0];
			} else {
				frontmatter[prop('spouse_id')] = person.spouseCrId;
			}
			logger.debug('spouse', `Added (id only): ${JSON.stringify(person.spouseCrId)}`);
		}
	} else if (person.spouse && person.spouse.length > 0) {
		// Legacy: name-based relationship only
		if (person.spouse.length === 1) {
			frontmatter[prop('spouse')] = `"[[${person.spouse[0]}]]"`;
		} else {
			frontmatter[prop('spouse')] = person.spouse.map(s => `"[[${s}]]"`);
		}
		logger.debug('spouse', `Added (legacy): ${JSON.stringify(person.spouse)}`);
	}

	// Children relationship(s) (dual storage)
	if (person.childCrId && person.childCrId.length > 0) {
		if (person.childName && person.childName.length === person.childCrId.length) {
			// Dual storage with both names and IDs
			if (person.childName.length === 1) {
				frontmatter[prop('child')] = `"[[${person.childName[0]}]]"`;
				frontmatter[prop('children_id')] = person.childCrId[0];
			} else {
				frontmatter[prop('child')] = person.childName.map(c => `"[[${c}]]"`);
				frontmatter[prop('children_id')] = person.childCrId;
			}
			logger.debug('children', `Added (dual): wikilinks=${JSON.stringify(person.childName)}, ids=${JSON.stringify(person.childCrId)}`);
		} else {
			// ID only (fallback for legacy data or missing names)
			if (person.childCrId.length === 1) {
				frontmatter[prop('children_id')] = person.childCrId[0];
			} else {
				frontmatter[prop('children_id')] = person.childCrId;
			}
			logger.debug('children', `Added (id only): ${JSON.stringify(person.childCrId)}`);
		}
	}

	// Step-father relationship(s) (dual storage)
	if (person.stepfatherCrId && person.stepfatherCrId.length > 0) {
		if (person.stepfatherName && person.stepfatherName.length === person.stepfatherCrId.length) {
			if (person.stepfatherName.length === 1) {
				frontmatter[prop('stepfather')] = `"[[${person.stepfatherName[0]}]]"`;
				frontmatter[prop('stepfather_id')] = person.stepfatherCrId[0];
			} else {
				frontmatter[prop('stepfather')] = person.stepfatherName.map(s => `"[[${s}]]"`);
				frontmatter[prop('stepfather_id')] = person.stepfatherCrId;
			}
			logger.debug('stepfather', `Added (dual): wikilinks=${JSON.stringify(person.stepfatherName)}, ids=${JSON.stringify(person.stepfatherCrId)}`);
		} else {
			if (person.stepfatherCrId.length === 1) {
				frontmatter[prop('stepfather_id')] = person.stepfatherCrId[0];
			} else {
				frontmatter[prop('stepfather_id')] = person.stepfatherCrId;
			}
			logger.debug('stepfather', `Added (id only): ${JSON.stringify(person.stepfatherCrId)}`);
		}
	}

	// Step-mother relationship(s) (dual storage)
	if (person.stepmotherCrId && person.stepmotherCrId.length > 0) {
		if (person.stepmotherName && person.stepmotherName.length === person.stepmotherCrId.length) {
			if (person.stepmotherName.length === 1) {
				frontmatter[prop('stepmother')] = `"[[${person.stepmotherName[0]}]]"`;
				frontmatter[prop('stepmother_id')] = person.stepmotherCrId[0];
			} else {
				frontmatter[prop('stepmother')] = person.stepmotherName.map(s => `"[[${s}]]"`);
				frontmatter[prop('stepmother_id')] = person.stepmotherCrId;
			}
			logger.debug('stepmother', `Added (dual): wikilinks=${JSON.stringify(person.stepmotherName)}, ids=${JSON.stringify(person.stepmotherCrId)}`);
		} else {
			if (person.stepmotherCrId.length === 1) {
				frontmatter[prop('stepmother_id')] = person.stepmotherCrId[0];
			} else {
				frontmatter[prop('stepmother_id')] = person.stepmotherCrId;
			}
			logger.debug('stepmother', `Added (id only): ${JSON.stringify(person.stepmotherCrId)}`);
		}
	}

	// Adoptive father relationship (dual storage)
	if (person.adoptiveFatherCrId) {
		if (person.adoptiveFatherName) {
			frontmatter[prop('adoptive_father')] = `"[[${person.adoptiveFatherName}]]"`;
			frontmatter[prop('adoptive_father_id')] = person.adoptiveFatherCrId;
			logger.debug('adoptive_father', `Added (dual): wikilink=${person.adoptiveFatherName}, id=${person.adoptiveFatherCrId}`);
		} else {
			frontmatter[prop('adoptive_father_id')] = person.adoptiveFatherCrId;
			logger.debug('adoptive_father', `Added (id only): ${person.adoptiveFatherCrId}`);
		}
	}

	// Adoptive mother relationship (dual storage)
	if (person.adoptiveMotherCrId) {
		if (person.adoptiveMotherName) {
			frontmatter[prop('adoptive_mother')] = `"[[${person.adoptiveMotherName}]]"`;
			frontmatter[prop('adoptive_mother_id')] = person.adoptiveMotherCrId;
			logger.debug('adoptive_mother', `Added (dual): wikilink=${person.adoptiveMotherName}, id=${person.adoptiveMotherCrId}`);
		} else {
			frontmatter[prop('adoptive_mother_id')] = person.adoptiveMotherCrId;
			logger.debug('adoptive_mother', `Added (id only): ${person.adoptiveMotherCrId}`);
		}
	}

	// Ensure all essential properties are present (even if empty)
	// This matches the "Add essential properties" feature expectations
	// Property names respect user-configured aliases
	const fatherProp = prop('father');
	const fatherIdProp = prop('father_id');
	if (!(fatherProp in frontmatter) && !(fatherIdProp in frontmatter)) {
		frontmatter[fatherProp] = '';
	}
	const motherProp = prop('mother');
	const motherIdProp = prop('mother_id');
	if (!(motherProp in frontmatter) && !(motherIdProp in frontmatter)) {
		frontmatter[motherProp] = '';
	}
	const spouseProp = prop('spouse');
	const spouseIdProp = prop('spouse_id');
	if (!(spouseProp in frontmatter) && !(spouseIdProp in frontmatter)) {
		frontmatter[spouseProp] = [];
	}
	const childProp = prop('child');
	const childrenIdProp = prop('children_id');
	if (!(childProp in frontmatter) && !(childrenIdProp in frontmatter)) {
		frontmatter[childProp] = [];
	}
	const groupNameProp = prop('group_name');
	if (!(groupNameProp in frontmatter)) {
		frontmatter[groupNameProp] = '';
	}

	logger.debug('frontmatter', `Final: ${JSON.stringify(frontmatter)}`);

	// Build YAML frontmatter string
	const yamlLines = ['---'];
	for (const [key, value] of Object.entries(frontmatter)) {
		if (Array.isArray(value)) {
			yamlLines.push(`${key}:`);
			for (const item of value) {
				// Handle potential object items in arrays
				const itemStr = typeof item === 'object' && item !== null ? JSON.stringify(item) : String(item);
				yamlLines.push(`  - ${itemStr}`);
			}
		} else if (typeof value === 'object' && value !== null) {
			// Handle nested objects by serializing to JSON
			yamlLines.push(`${key}: ${JSON.stringify(value)}`);
		} else {
			// Quote values that contain wikilinks to prevent YAML parsing issues
			// [[foo]] in YAML is interpreted as nested array [["foo"]]
			const strValue = String(value);
			const needsQuotes = typeof value === 'string' && strValue.includes('[[') && !strValue.startsWith('"');
			if (needsQuotes) {
				yamlLines.push(`${key}: "${strValue}"`);
			} else {
				yamlLines.push(`${key}: ${strValue}`);
			}
		}
	}
	yamlLines.push('---');

	// Build note content
	const bodyLines: string[] = ['', '# Research Notes', '', '', ''];

	// Add dynamic content blocks if requested
	if (includeDynamicBlocks && dynamicBlockTypes.length > 0) {
		// Add relationships block first (usually comes before timeline in a person note)
		if (dynamicBlockTypes.includes('relationships')) {
			bodyLines.push('```canvas-roots-relationships');
			bodyLines.push('type: immediate');
			bodyLines.push('```');
			bodyLines.push('');
		}

		// Add timeline block
		if (dynamicBlockTypes.includes('timeline')) {
			bodyLines.push('```canvas-roots-timeline');
			bodyLines.push('sort: chronological');
			bodyLines.push('```');
			bodyLines.push('');
		}
	}

	const noteContent = [
		...yamlLines,
		...bodyLines
	].join('\n');

	// Format filename based on selected format
	const filename = formatFilename(person.name || 'Untitled Person', filenameFormat);

	// Build full path
	const fullPath = directory
		? normalizePath(`${directory}/${filename}`)
		: normalizePath(filename);

	// Check if file already exists
	let finalPath = fullPath;
	let counter = 1;
	while (app.vault.getAbstractFileByPath(finalPath)) {
		const baseName = person.name || 'Untitled Person';
		const newFilename = formatFilename(`${baseName} ${counter}`, filenameFormat);
		finalPath = directory
			? normalizePath(`${directory}/${newFilename}`)
			: normalizePath(newFilename);
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
			const arrayMatches = frontmatterText.match(/^ {2}- (.+)$/gm);
			if (arrayMatches) {
				spouseValues = arrayMatches.map(m => m.replace(/^ {2}- /, '').trim());
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
		newFrontmatterText = newFrontmatterText.replace(/^ {2}- [^\n]+$/gm, '');
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
 * Update an existing person note's frontmatter
 *
 * @param app - Obsidian app instance
 * @param file - The file to update
 * @param person - Person data to update
 */
export async function updatePersonNote(
	app: App,
	file: TFile,
	person: Partial<PersonData>
): Promise<void> {
	await app.fileManager.processFrontMatter(file, (frontmatter) => {
		// Update basic fields if provided
		if (person.name !== undefined) frontmatter.name = person.name;
		if (person.birthDate !== undefined) frontmatter.born = person.birthDate || '';
		if (person.deathDate !== undefined) frontmatter.died = person.deathDate || '';
		if (person.sex !== undefined) {
			if (person.sex) {
				frontmatter.sex = person.sex;
			} else {
				delete frontmatter.sex;
			}
		}
		if (person.occupation !== undefined) {
			if (person.occupation) {
				frontmatter.occupation = person.occupation;
			} else {
				delete frontmatter.occupation;
			}
		}
		if (person.birthPlace !== undefined) {
			if (person.birthPlace) {
				frontmatter.birth_place = person.birthPlace;
			} else {
				delete frontmatter.birth_place;
			}
		}
		if (person.deathPlace !== undefined) {
			if (person.deathPlace) {
				frontmatter.death_place = person.deathPlace;
			} else {
				delete frontmatter.death_place;
			}
		}

		// Handle father relationship
		if (person.fatherCrId !== undefined || person.fatherName !== undefined) {
			if (person.fatherCrId && person.fatherName) {
				frontmatter.father = `[[${person.fatherName}]]`;
				frontmatter.father_id = person.fatherCrId;
			} else if (person.fatherCrId) {
				frontmatter.father_id = person.fatherCrId;
			} else if (person.fatherName) {
				frontmatter.father = `[[${person.fatherName}]]`;
			} else {
				// Clear father
				delete frontmatter.father;
				delete frontmatter.father_id;
			}
		}

		// Handle mother relationship
		if (person.motherCrId !== undefined || person.motherName !== undefined) {
			if (person.motherCrId && person.motherName) {
				frontmatter.mother = `[[${person.motherName}]]`;
				frontmatter.mother_id = person.motherCrId;
			} else if (person.motherCrId) {
				frontmatter.mother_id = person.motherCrId;
			} else if (person.motherName) {
				frontmatter.mother = `[[${person.motherName}]]`;
			} else {
				// Clear mother
				delete frontmatter.mother;
				delete frontmatter.mother_id;
			}
		}

		// Handle spouse relationships
		if (person.spouseCrId !== undefined || person.spouseName !== undefined) {
			if (person.spouseCrId && person.spouseCrId.length > 0) {
				if (person.spouseName && person.spouseName.length === person.spouseCrId.length) {
					frontmatter.spouse = person.spouseName.length === 1
						? `[[${person.spouseName[0]}]]`
						: person.spouseName.map(s => `[[${s}]]`);
					frontmatter.spouse_id = person.spouseCrId.length === 1
						? person.spouseCrId[0]
						: person.spouseCrId;
				} else {
					frontmatter.spouse_id = person.spouseCrId.length === 1
						? person.spouseCrId[0]
						: person.spouseCrId;
				}
			} else {
				// Clear spouse
				delete frontmatter.spouse;
				delete frontmatter.spouse_id;
				delete frontmatter.spouses;
			}
		}

		logger.debug('update-person', `Updated frontmatter for ${file.path}`);
	});
}

/**
 * Format a filename based on the selected format option
 *
 * @param name - The name to format
 * @param format - The filename format to use
 * @returns Formatted filename with .md extension
 */
function formatFilename(name: string, format: FilenameFormat): string {
	// First sanitize illegal filesystem characters
	const sanitized = name
		.replace(/[\\/:*?"<>|]/g, '')
		.trim();

	switch (format) {
		case 'kebab-case':
			return sanitized
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/^-+|-+$/g, '')
				.substring(0, 100) + '.md';

		case 'snake_case':
			return sanitized
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '_')
				.replace(/^_+|_+$/g, '')
				.substring(0, 100) + '.md';

		case 'original':
		default:
			// Keep original casing and spaces, just sanitize
			return sanitized.replace(/\s+/g, ' ').substring(0, 100) + '.md';
	}
}
