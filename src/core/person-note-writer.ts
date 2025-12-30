/**
 * Person note writer utilities for Canvas Roots
 * Creates person notes with proper YAML frontmatter
 */

import { App, TFile, normalizePath } from 'obsidian';
import { generateCrId } from './uuid';
import { getLogger } from './logging';
import type { ResearchLevel } from '../types/frontmatter';

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
 * Strip wikilink brackets from a string
 * Handles both [[Name]] and [[Basename|Display]] formats
 */
function stripWikilink(text: string): string {
	// Match [[basename|display]] or [[name]]
	const match = text.match(/^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]$/);
	if (match) {
		// Return the display name if present, otherwise the basename
		return match[2] || match[1];
	}
	return text;
}

/**
 * Create a wikilink with proper handling of duplicate filenames
 * Uses [[basename|name]] format when basename differs from name
 * @param name The display name (can already be a wikilink)
 * @param app The Obsidian app instance for file resolution
 */
function createSmartWikilink(name: string, app: App): string {
	// Strip existing brackets if present
	const cleanName = stripWikilink(name);

	// Try to resolve the name to a file
	const resolvedFile = app.metadataCache.getFirstLinkpathDest(cleanName, '');
	if (resolvedFile && resolvedFile.basename !== cleanName) {
		return `[[${resolvedFile.basename}|${cleanName}]]`;
	}

	// Standard format
	return `[[${cleanName}]]`;
}

/**
 * Person data for note creation
 */
export interface PersonData {
	name: string;
	crId?: string;
	nickname?: string;           // Informal name, alias, or nickname (e.g., "Bobby" for Robert)
	birthDate?: string;
	deathDate?: string;
	birthPlace?: string;
	deathPlace?: string;
	occupation?: string;
	sex?: string;
	collection?: string;    // User-defined grouping
	universe?: string;      // Fictional universe or world
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
	// Gender-neutral parent relationships
	parentCrId?: string[];       // Gender-neutral parent(s) cr_id
	parentName?: string[];       // Gender-neutral parent(s) name for wikilink display
	// Place relationships (dual storage like relationships)
	birthPlaceCrId?: string;     // Birth place cr_id for reliable resolution
	birthPlaceName?: string;     // Birth place name for wikilink display
	deathPlaceCrId?: string;     // Death place cr_id for reliable resolution
	deathPlaceName?: string;     // Death place name for wikilink display
	// Media references
	media?: string[];            // Wikilinks to media files (e.g., ["[[photo.jpg]]"])
	// Research tracking
	researchLevel?: ResearchLevel;  // Research level (0-6) based on Hoitink's Six Levels
}

/**
 * Filename format options
 */
export type FilenameFormat = 'original' | 'kebab-case' | 'snake_case';

/**
 * Dynamic block types that can be included in person notes
 */
export type DynamicBlockType = 'timeline' | 'relationships' | 'media';

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
	/** Which dynamic block types to include (default: ['media', 'timeline', 'relationships']) */
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
		dynamicBlockTypes = ['media', 'timeline', 'relationships']
	} = options;

	// Helper to get aliased property name
	const prop = (canonical: string) => getWriteProperty(canonical, propertyAliases);

	// Generate cr_id if not provided
	const crId = person.crId || generateCrId();

	// Build frontmatter with essential properties
	// Essential properties are always included (per Guide documentation)
	// Property names respect user-configured aliases
	const frontmatter: Record<string, string | string[] | number> = {
		[prop('cr_id')]: crId,
		[prop('cr_type')]: 'person',
		[prop('name')]: person.name || '',
		[prop('born')]: person.birthDate || '',
		[prop('died')]: person.deathDate || ''
	};

	// Birth place (dual storage: wikilink + ID for reliable resolution)
	if (person.birthPlaceCrId && person.birthPlaceName) {
		frontmatter[prop('birth_place')] = `"${createSmartWikilink(person.birthPlaceName, app)}"`;
		frontmatter[prop('birth_place_id')] = person.birthPlaceCrId;
		logger.debug('birthPlace', `Added (dual): wikilink=${person.birthPlaceName}, id=${person.birthPlaceCrId}`);
	} else if (person.birthPlace) {
		// Fallback for plain text (legacy or unlinked)
		frontmatter[prop('birth_place')] = person.birthPlace;
		logger.debug('birthPlace', `Added (plain text): ${person.birthPlace}`);
	}

	// Death place (dual storage: wikilink + ID for reliable resolution)
	if (person.deathPlaceCrId && person.deathPlaceName) {
		frontmatter[prop('death_place')] = `"${createSmartWikilink(person.deathPlaceName, app)}"`;
		frontmatter[prop('death_place_id')] = person.deathPlaceCrId;
		logger.debug('deathPlace', `Added (dual): wikilink=${person.deathPlaceName}, id=${person.deathPlaceCrId}`);
	} else if (person.deathPlace) {
		// Fallback for plain text (legacy or unlinked)
		frontmatter[prop('death_place')] = person.deathPlace;
		logger.debug('deathPlace', `Added (plain text): ${person.deathPlace}`);
	}

	if (person.nickname) {
		frontmatter[prop('nickname')] = person.nickname;
	}

	if (person.occupation) {
		frontmatter[prop('occupation')] = person.occupation;
	}

	if (person.sex) {
		frontmatter[prop('sex')] = person.sex;
	}

	if (person.collection) {
		frontmatter[prop('collection')] = person.collection;
	}

	if (person.universe) {
		frontmatter[prop('universe')] = person.universe;
	}

	if (person.researchLevel !== undefined) {
		frontmatter[prop('research_level')] = person.researchLevel;
	}

	// Handle relationships using dual storage: wikilinks for Obsidian + _id fields for reliability
	// Property names respect user-configured aliases
	logger.debug('relationships', `Processing - fatherCrId: ${person.fatherCrId}, motherCrId: ${person.motherCrId}, spouseCrId: ${person.spouseCrId?.join(', ') ?? 'none'}`);

	// Father relationship (dual storage)
	if (person.fatherCrId && person.fatherName) {
		frontmatter[prop('father')] = `"${createSmartWikilink(person.fatherName, app)}"`;
		frontmatter[prop('father_id')] = person.fatherCrId;
		logger.debug('father', `Added (dual): wikilink=${person.fatherName}, id=${person.fatherCrId}`);
	} else if (person.fatherCrId) {
		// ID only (fallback for legacy data)
		frontmatter[prop('father_id')] = person.fatherCrId;
		logger.debug('father', `Added (id only): ${person.fatherCrId}`);
	} else if (person.father) {
		// Legacy: name-based relationship only
		frontmatter[prop('father')] = `"${createSmartWikilink(person.father, app)}"`;
		logger.debug('father', `Added (legacy): ${person.father}`);
	}

	// Mother relationship (dual storage)
	if (person.motherCrId && person.motherName) {
		frontmatter[prop('mother')] = `"${createSmartWikilink(person.motherName, app)}"`;
		frontmatter[prop('mother_id')] = person.motherCrId;
		logger.debug('mother', `Added (dual): wikilink=${person.motherName}, id=${person.motherCrId}`);
	} else if (person.motherCrId) {
		// ID only (fallback for legacy data)
		frontmatter[prop('mother_id')] = person.motherCrId;
		logger.debug('mother', `Added (id only): ${person.motherCrId}`);
	} else if (person.mother) {
		// Legacy: name-based relationship only
		frontmatter[prop('mother')] = `"${createSmartWikilink(person.mother, app)}"`;
		logger.debug('mother', `Added (legacy): ${person.mother}`);
	}

	// Spouse relationship(s) (dual storage)
	if (person.spouseCrId && person.spouseCrId.length > 0) {
		if (person.spouseName && person.spouseName.length === person.spouseCrId.length) {
			// Dual storage with both names and IDs
			if (person.spouseName.length === 1) {
				frontmatter[prop('spouse')] = `"${createSmartWikilink(person.spouseName[0], app)}"`;
				frontmatter[prop('spouse_id')] = person.spouseCrId[0];
			} else {
				frontmatter[prop('spouse')] = person.spouseName.map(s => `"${createSmartWikilink(s, app)}"`);
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
			frontmatter[prop('spouse')] = `"${createSmartWikilink(person.spouse[0], app)}"`;
		} else {
			frontmatter[prop('spouse')] = person.spouse.map(s => `"${createSmartWikilink(s, app)}"`);
		}
		logger.debug('spouse', `Added (legacy): ${JSON.stringify(person.spouse)}`);
	}

	// Children relationship(s) (dual storage)
	if (person.childCrId && person.childCrId.length > 0) {
		if (person.childName && person.childName.length === person.childCrId.length) {
			// Dual storage with both names and IDs
			if (person.childName.length === 1) {
				frontmatter[prop('child')] = `"${createSmartWikilink(person.childName[0], app)}"`;
				frontmatter[prop('children_id')] = person.childCrId[0];
			} else {
				frontmatter[prop('child')] = person.childName.map(c => `"${createSmartWikilink(c, app)}"`);
				frontmatter[prop('children_id')] = [...person.childCrId]; // Make a copy to avoid reference issues
			}
			logger.debug('children', `Added (dual): wikilinks=${JSON.stringify(person.childName)}, ids=${JSON.stringify(person.childCrId)}`);
		} else {
			// ID only (fallback for legacy data or missing names)
			if (person.childCrId.length === 1) {
				frontmatter[prop('children_id')] = person.childCrId[0];
			} else {
				frontmatter[prop('children_id')] = [...person.childCrId]; // Make a copy to avoid reference issues
			}
			logger.debug('children', `Added (id only): ${JSON.stringify(person.childCrId)}`);
		}

		// Debug: Log what was actually set
		logger.debug('children-output', `Person ${person.name}: frontmatter[children_id]=${JSON.stringify(frontmatter[prop('children_id')])}`);
	}

	// Step-father relationship(s) (dual storage)
	if (person.stepfatherCrId && person.stepfatherCrId.length > 0) {
		if (person.stepfatherName && person.stepfatherName.length === person.stepfatherCrId.length) {
			if (person.stepfatherName.length === 1) {
				frontmatter[prop('stepfather')] = `"${createSmartWikilink(person.stepfatherName[0], app)}"`;
				frontmatter[prop('stepfather_id')] = person.stepfatherCrId[0];
			} else {
				frontmatter[prop('stepfather')] = person.stepfatherName.map(s => `"${createSmartWikilink(s, app)}"`);
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
				frontmatter[prop('stepmother')] = `"${createSmartWikilink(person.stepmotherName[0], app)}"`;
				frontmatter[prop('stepmother_id')] = person.stepmotherCrId[0];
			} else {
				frontmatter[prop('stepmother')] = person.stepmotherName.map(s => `"${createSmartWikilink(s, app)}"`);
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
			frontmatter[prop('adoptive_father')] = `"${createSmartWikilink(person.adoptiveFatherName, app)}"`;
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
			frontmatter[prop('adoptive_mother')] = `"${createSmartWikilink(person.adoptiveMotherName, app)}"`;
			frontmatter[prop('adoptive_mother_id')] = person.adoptiveMotherCrId;
			logger.debug('adoptive_mother', `Added (dual): wikilink=${person.adoptiveMotherName}, id=${person.adoptiveMotherCrId}`);
		} else {
			frontmatter[prop('adoptive_mother_id')] = person.adoptiveMotherCrId;
			logger.debug('adoptive_mother', `Added (id only): ${person.adoptiveMotherCrId}`);
		}
	}

	// Gender-neutral parent relationship(s) (dual storage)
	if (person.parentCrId && person.parentCrId.length > 0) {
		if (person.parentName && person.parentName.length === person.parentCrId.length) {
			if (person.parentName.length === 1) {
				frontmatter[prop('parents')] = `"${createSmartWikilink(person.parentName[0], app)}"`;
				frontmatter[prop('parents_id')] = person.parentCrId[0];
			} else {
				frontmatter[prop('parents')] = person.parentName.map(p => `"${createSmartWikilink(p, app)}"`);
				frontmatter[prop('parents_id')] = person.parentCrId;
			}
			logger.debug('parents', `Added (dual): wikilinks=${JSON.stringify(person.parentName)}, ids=${JSON.stringify(person.parentCrId)}`);
		} else {
			if (person.parentCrId.length === 1) {
				frontmatter[prop('parents_id')] = person.parentCrId[0];
			} else {
				frontmatter[prop('parents_id')] = person.parentCrId;
			}
			logger.debug('parents', `Added (id only): ${JSON.stringify(person.parentCrId)}`);
		}
	}

	// Add media references if available
	if (person.media && person.media.length > 0) {
		// Media is stored as array of wikilinks
		frontmatter[prop('media')] = person.media;
		logger.debug('media', `Added ${person.media.length} media references`);
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

	// Add dynamic content blocks if requested, in the order specified by dynamicBlockTypes
	if (includeDynamicBlocks && dynamicBlockTypes.length > 0) {
		for (const blockType of dynamicBlockTypes) {
			if (blockType === 'media') {
				bodyLines.push('```canvas-roots-media');
				bodyLines.push('columns: 3');
				bodyLines.push('size: medium');
				bodyLines.push('editable: true');
				bodyLines.push('```');
				bodyLines.push('');
			} else if (blockType === 'timeline') {
				bodyLines.push('```canvas-roots-timeline');
				bodyLines.push('sort: chronological');
				bodyLines.push('```');
				bodyLines.push('');
			} else if (blockType === 'relationships') {
				bodyLines.push('```canvas-roots-relationships');
				bodyLines.push('type: immediate');
				bodyLines.push('```');
				bodyLines.push('');
			}
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

	// Handle bidirectional linking for relationships
	if (addBidirectionalLinks) {
		// Spouse linking
		if (person.spouseCrId && person.spouseCrId.length > 0) {
			for (const spouseCrId of person.spouseCrId) {
				await addBidirectionalSpouseLink(app, spouseCrId, crId, person.name, directory);
			}
		}

		// Parent-child linking: add this person as child to father
		if (person.fatherCrId && person.fatherName) {
			await addChildToParent(app, person.fatherCrId, crId, person.name, directory);
		}

		// Parent-child linking: add this person as child to mother
		if (person.motherCrId && person.motherName) {
			await addChildToParent(app, person.motherCrId, crId, person.name, directory);
		}

		// Reverse parent-child linking: add children to this person's children array
		if (person.childCrId && person.childCrId.length > 0 && person.childName && person.childName.length === person.childCrId.length) {
			for (let i = 0; i < person.childCrId.length; i++) {
				const childCrId = person.childCrId[i];
				const childName = person.childName[i];
				await addParentToChild(app, childCrId, crId, person.name, person.sex, directory);
			}
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
 * Find a person file by cr_id
 */
export async function findPersonByCrId(app: App, crId: string, directory?: string): Promise<TFile | null> {
	const files = app.vault.getMarkdownFiles();

	for (const file of files) {
		// Only check files in the specified directory (or root if no directory)
		if (directory && !file.path.startsWith(directory)) {
			continue;
		}

		const cache = app.metadataCache.getFileCache(file);
		if (cache?.frontmatter?.cr_id === crId) {
			return file;
		}
	}

	return null;
}

/**
 * Add bidirectional spouse link to an existing person note
 * Updates the spouse's spouse_id array to include the new person
 */
export async function addBidirectionalSpouseLink(
	app: App,
	spouseCrId: string,
	newSpouseCrId: string,
	newSpouseName: string,
	directory: string
): Promise<void> {
	logger.debug('bidirectional-spouse', `Adding ${newSpouseCrId} (${newSpouseName}) as spouse to ${spouseCrId}`);

	// Find the spouse's file by cr_id
	const spouseFile = await findPersonByCrId(app, spouseCrId, directory);

	if (!spouseFile) {
		logger.warn('bidirectional-spouse', `Could not find spouse file with cr_id: ${spouseCrId}`);
		return;
	}

	logger.debug('bidirectional-spouse', `Found spouse file: ${spouseFile.path}`);

	// Get existing spouse data
	const cache = app.metadataCache.getFileCache(spouseFile);
	const existingSpouseIds = cache?.frontmatter?.spouse_id;
	const existingSpouseNames = cache?.frontmatter?.spouse;

	// Normalize to arrays
	let spouseIds: string[] = [];
	let spouseNames: string[] = [];

	if (existingSpouseIds) {
		spouseIds = Array.isArray(existingSpouseIds) ? [...existingSpouseIds] : [existingSpouseIds];
	}
	if (existingSpouseNames) {
		spouseNames = Array.isArray(existingSpouseNames) ? [...existingSpouseNames] : [existingSpouseNames];
	}

	// Add new spouse if not already present
	if (!spouseIds.includes(newSpouseCrId)) {
		spouseIds.push(newSpouseCrId);
		spouseNames.push(newSpouseName);

		logger.debug('bidirectional-spouse', `Updating spouse arrays: ids=${JSON.stringify(spouseIds)}, names=${JSON.stringify(spouseNames)}`);

		// Use updatePersonNote to properly handle dual storage
		await updatePersonNote(app, spouseFile, {
			spouseCrId: spouseIds,
			spouseName: spouseNames
		});

		logger.info('bidirectional-spouse', `Updated spouse link in ${spouseFile.path}`);
	} else {
		logger.debug('bidirectional-spouse', `Spouse ${newSpouseCrId} already linked in ${spouseFile.path}`);
	}
}

/**
 * Add this person as a child to a parent's children array
 * Updates the parent's children_id and child fields
 */
export async function addChildToParent(
	app: App,
	parentCrId: string,
	childCrId: string,
	childName: string,
	directory: string
): Promise<void> {
	logger.debug('bidirectional-child', `Adding ${childCrId} (${childName}) as child to parent ${parentCrId}`);

	// Find the parent's file by cr_id
	const parentFile = await findPersonByCrId(app, parentCrId, directory);

	if (!parentFile) {
		logger.warn('bidirectional-child', `Could not find parent file with cr_id: ${parentCrId}`);
		return;
	}

	logger.debug('bidirectional-child', `Found parent file: ${parentFile.path}`);

	// Get existing children data
	const cache = app.metadataCache.getFileCache(parentFile);
	const existingChildIds = cache?.frontmatter?.children_id;
	const existingChildNames = cache?.frontmatter?.child;

	// Normalize to arrays
	let childIds: string[] = [];
	let childNames: string[] = [];

	if (existingChildIds) {
		childIds = Array.isArray(existingChildIds) ? [...existingChildIds] : [existingChildIds];
	}
	if (existingChildNames) {
		childNames = Array.isArray(existingChildNames) ? [...existingChildNames] : [existingChildNames];
	}

	// Add new child if not already present
	if (!childIds.includes(childCrId)) {
		childIds.push(childCrId);
		childNames.push(childName);

		logger.debug('bidirectional-child', `Updating children arrays: ids=${JSON.stringify(childIds)}, names=${JSON.stringify(childNames)}`);

		// Use updatePersonNote to properly handle dual storage
		await updatePersonNote(app, parentFile, {
			childCrId: childIds,
			childName: childNames
		});

		logger.info('bidirectional-child', `Updated children link in ${parentFile.path}`);
	} else {
		logger.debug('bidirectional-child', `Child ${childCrId} already linked in ${parentFile.path}`);
	}
}

/**
 * Add a parent relationship to a child's father_id/mother_id field
 * Updates the child's father or mother field based on parent's sex
 * Also automatically links the parent's spouse as the other parent
 */
export async function addParentToChild(
	app: App,
	childCrId: string,
	parentCrId: string,
	parentName: string,
	parentSex: string | undefined,
	directory: string
): Promise<void> {
	logger.debug('bidirectional-parent', `Adding ${parentCrId} (${parentName}) as parent to child ${childCrId}`);

	// Find the child's file by cr_id
	const childFile = await findPersonByCrId(app, childCrId, directory);

	if (!childFile) {
		logger.warn('bidirectional-parent', `Could not find child file with cr_id: ${childCrId}`);
		return;
	}

	logger.debug('bidirectional-parent', `Found child file: ${childFile.path}`);

	// Get existing parent data
	const cache = app.metadataCache.getFileCache(childFile);
	const existingFatherId = cache?.frontmatter?.father_id;
	const existingMotherId = cache?.frontmatter?.mother_id;

	// Determine parent type from sex (default to father if unknown)
	const isMother = parentSex === 'female' || parentSex === 'F';

	// Check if parent is already set
	if (isMother && existingMotherId === parentCrId) {
		logger.debug('bidirectional-parent', `Mother ${parentCrId} already linked in ${childFile.path}`);
		return;
	}
	if (!isMother && existingFatherId === parentCrId) {
		logger.debug('bidirectional-parent', `Father ${parentCrId} already linked in ${childFile.path}`);
		return;
	}

	// Add parent relationship
	if (isMother) {
		logger.debug('bidirectional-parent', `Setting mother: ${parentName} (${parentCrId})`);
		await updatePersonNote(app, childFile, {
			motherCrId: parentCrId,
			motherName: parentName
		});
	} else {
		logger.debug('bidirectional-parent', `Setting father: ${parentName} (${parentCrId})`);
		await updatePersonNote(app, childFile, {
			fatherCrId: parentCrId,
			fatherName: parentName
		});
	}

	logger.info('bidirectional-parent', `Updated parent link in ${childFile.path}`);

	// Also link the parent's spouse as the other parent (if they have one)
	const parentFile = await findPersonByCrId(app, parentCrId, directory);
	if (parentFile) {
		const parentCache = app.metadataCache.getFileCache(parentFile);
		const spouseIds = parentCache?.frontmatter?.spouse_id;
		const spouseNames = parentCache?.frontmatter?.spouse;

		logger.debug('bidirectional-parent', `Checking for spouse - spouseIds: ${JSON.stringify(spouseIds)}, spouseNames: ${JSON.stringify(spouseNames)}`);

		if (spouseIds) {
			// Normalize to arrays
			const spouseIdArray = Array.isArray(spouseIds) ? spouseIds : [spouseIds];
			const spouseNameArray = Array.isArray(spouseNames) ? spouseNames : spouseNames ? [spouseNames] : [];

			// Link the first spouse as the other parent
			if (spouseIdArray.length > 0 && spouseNameArray.length > 0) {
				const spouseCrId = spouseIdArray[0];
				const spouseName = spouseNameArray[0];

				logger.debug('bidirectional-parent', `Also linking spouse ${spouseCrId} (${spouseName}) as other parent`);

				// Set the spouse as the other parent on the child
				if (isMother) {
					// Parent is mother, so spouse is father
					if (!existingFatherId) {
						await updatePersonNote(app, childFile, {
							fatherCrId: spouseCrId,
							fatherName: spouseName
						});
						logger.info('bidirectional-parent', `Set spouse as father in ${childFile.path}`);
					} else {
						logger.debug('bidirectional-parent', `Skipping father link - already set to ${existingFatherId}`);
					}
				} else {
					// Parent is father, so spouse is mother
					if (!existingMotherId) {
						await updatePersonNote(app, childFile, {
							motherCrId: spouseCrId,
							motherName: spouseName
						});
						logger.info('bidirectional-parent', `Set spouse as mother in ${childFile.path}`);
					} else {
						logger.debug('bidirectional-parent', `Skipping mother link - already set to ${existingMotherId}`);
					}
				}

				// Add child to spouse's children array
				logger.debug('bidirectional-parent', `Adding child ${childCrId} to spouse ${spouseCrId}`);
				await addChildToParent(app, spouseCrId, childCrId, cache?.frontmatter?.name || childFile.basename, directory);
			} else {
				logger.debug('bidirectional-parent', `Spouse arrays empty or mismatched lengths`);
			}
		} else {
			logger.debug('bidirectional-parent', `Parent ${parentCrId} has no spouse`);
		}
	} else {
		logger.warn('bidirectional-parent', `Could not find parent file for cr_id: ${parentCrId}`);
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
		if (person.nickname !== undefined) {
			if (person.nickname) {
				frontmatter.nickname = person.nickname;
			} else {
				delete frontmatter.nickname;
			}
		}
		if (person.occupation !== undefined) {
			if (person.occupation) {
				frontmatter.occupation = person.occupation;
			} else {
				delete frontmatter.occupation;
			}
		}
		if (person.researchLevel !== undefined) {
			if (person.researchLevel !== null) {
				frontmatter.research_level = person.researchLevel;
			} else {
				delete frontmatter.research_level;
			}
		}
		// Handle birth place (dual storage: wikilink + ID)
		if (person.birthPlaceCrId !== undefined || person.birthPlaceName !== undefined) {
			if (person.birthPlaceCrId && person.birthPlaceName) {
				frontmatter.birth_place = `${createSmartWikilink(person.birthPlaceName, app)}`;
				frontmatter.birth_place_id = person.birthPlaceCrId;
			} else if (person.birthPlaceName) {
				frontmatter.birth_place = `${createSmartWikilink(person.birthPlaceName, app)}`;
				delete frontmatter.birth_place_id;
			} else {
				// Clear birth place
				delete frontmatter.birth_place;
				delete frontmatter.birth_place_id;
			}
		} else if (person.birthPlace !== undefined) {
			// Legacy: plain text birth place
			if (person.birthPlace) {
				frontmatter.birth_place = person.birthPlace;
			} else {
				delete frontmatter.birth_place;
			}
		}

		// Handle death place (dual storage: wikilink + ID)
		if (person.deathPlaceCrId !== undefined || person.deathPlaceName !== undefined) {
			if (person.deathPlaceCrId && person.deathPlaceName) {
				frontmatter.death_place = `${createSmartWikilink(person.deathPlaceName, app)}`;
				frontmatter.death_place_id = person.deathPlaceCrId;
			} else if (person.deathPlaceName) {
				frontmatter.death_place = `${createSmartWikilink(person.deathPlaceName, app)}`;
				delete frontmatter.death_place_id;
			} else {
				// Clear death place
				delete frontmatter.death_place;
				delete frontmatter.death_place_id;
			}
		} else if (person.deathPlace !== undefined) {
			// Legacy: plain text death place
			if (person.deathPlace) {
				frontmatter.death_place = person.deathPlace;
			} else {
				delete frontmatter.death_place;
			}
		}

		// Handle collection
		if (person.collection !== undefined) {
			if (person.collection) {
				frontmatter.collection = person.collection;
			} else {
				delete frontmatter.collection;
			}
		}

		// Handle universe
		if (person.universe !== undefined) {
			if (person.universe) {
				frontmatter.universe = person.universe;
			} else {
				delete frontmatter.universe;
			}
		}

		// Handle father relationship
		if (person.fatherCrId !== undefined || person.fatherName !== undefined) {
			if (person.fatherCrId && person.fatherName) {
				frontmatter.father = `${createSmartWikilink(person.fatherName, app)}`;
				frontmatter.father_id = person.fatherCrId;
			} else if (person.fatherCrId) {
				frontmatter.father_id = person.fatherCrId;
			} else if (person.fatherName) {
				frontmatter.father = `${createSmartWikilink(person.fatherName, app)}`;
			} else {
				// Clear father
				delete frontmatter.father;
				delete frontmatter.father_id;
			}
		}

		// Handle mother relationship
		if (person.motherCrId !== undefined || person.motherName !== undefined) {
			if (person.motherCrId && person.motherName) {
				frontmatter.mother = `${createSmartWikilink(person.motherName, app)}`;
				frontmatter.mother_id = person.motherCrId;
			} else if (person.motherCrId) {
				frontmatter.mother_id = person.motherCrId;
			} else if (person.motherName) {
				frontmatter.mother = `${createSmartWikilink(person.motherName, app)}`;
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
						? `${createSmartWikilink(person.spouseName[0], app)}`
						: person.spouseName.map(s => createSmartWikilink(s, app));
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

		// Handle children relationships (use 'children' plural to match 'children_id')
		if (person.childCrId !== undefined || person.childName !== undefined) {
			if (person.childCrId && person.childCrId.length > 0) {
				if (person.childName && person.childName.length === person.childCrId.length) {
					frontmatter.children = person.childName.length === 1
						? `${createSmartWikilink(person.childName[0], app)}`
						: person.childName.map(c => createSmartWikilink(c, app));
					frontmatter.children_id = person.childCrId.length === 1
						? person.childCrId[0]
						: person.childCrId;
				} else {
					frontmatter.children_id = person.childCrId.length === 1
						? person.childCrId[0]
						: person.childCrId;
				}
				// Remove legacy 'child' property if present
				delete frontmatter.child;
				logger.debug('update-children', `Set children: ${JSON.stringify(person.childName)}, ids: ${JSON.stringify(person.childCrId)}`);
			} else {
				// Clear children (both new and legacy property names)
				delete frontmatter.children;
				delete frontmatter.child;
				delete frontmatter.children_id;
				logger.debug('update-children', 'Cleared children');
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
