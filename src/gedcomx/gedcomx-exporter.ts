/**
 * GEDCOM X Exporter for Canvas Roots
 *
 * Exports person notes from Obsidian vault to GEDCOM X JSON format.
 * Based on the FamilySearch GEDCOM X specification.
 */

import { App, Notice } from 'obsidian';
import { FamilyGraphService, type PersonNode } from '../core/family-graph';
import { FolderFilterService } from '../core/folder-filter';
import { getLogger } from '../core/logging';
import { getErrorMessage } from '../core/error-utils';
import { PrivacyService, type PrivacySettings } from '../core/privacy-service';
import {
	type GedcomXDocument,
	type GedcomXPerson,
	type GedcomXRelationship,
	type GedcomXName,
	type GedcomXFact,
	type GedcomXSourceDescription,
	type GedcomXAgent,
	GEDCOMX_TYPES
} from './gedcomx-types';

const logger = getLogger('GedcomXExporter');

/**
 * GEDCOM X export options
 */
export interface GedcomXExportOptions {
	/** People folder to export from */
	peopleFolder: string;

	/** Collection filter - only export people in this collection */
	collectionFilter?: string;

	/** Branch filter - cr_id of person to filter around */
	branchRootCrId?: string;

	/** Branch direction - export ancestors or descendants of branchRootCrId */
	branchDirection?: 'ancestors' | 'descendants';

	/** Include spouses when exporting a branch (applies to descendants) */
	branchIncludeSpouses?: boolean;

	/** Export filename (without .json extension) */
	fileName?: string;

	/** Source application identifier */
	sourceApp?: string;

	/** Source version */
	sourceVersion?: string;

	/** Privacy settings for protecting living persons */
	privacySettings?: PrivacySettings;
}

/**
 * GEDCOM X export result
 */
export interface GedcomXExportResult {
	success: boolean;
	personsExported: number;
	relationshipsExported: number;
	errors: string[];
	jsonContent?: string;
	fileName: string;
	/** Number of living persons excluded due to privacy settings */
	privacyExcluded?: number;
	/** Number of living persons with obfuscated data */
	privacyObfuscated?: number;
}

/**
 * Export person notes to GEDCOM X JSON format
 */
export class GedcomXExporter {
	private app: App;
	private graphService: FamilyGraphService;

	constructor(app: App, folderFilter?: FolderFilterService) {
		this.app = app;
		this.graphService = new FamilyGraphService(app);
		if (folderFilter) {
			this.graphService.setFolderFilter(folderFilter);
		}
	}

	/**
	 * Export people to GEDCOM X format
	 */
	exportToGedcomX(options: GedcomXExportOptions): GedcomXExportResult {
		const result: GedcomXExportResult = {
			success: false,
			personsExported: 0,
			relationshipsExported: 0,
			errors: [],
			fileName: options.fileName || 'export',
			privacyExcluded: 0,
			privacyObfuscated: 0
		};

		// Create privacy service if settings provided
		const privacyService = options.privacySettings
			? new PrivacyService(options.privacySettings)
			: null;

		try {
			new Notice('Reading person notes...');

			// Load all people using the family graph service
			this.graphService['loadPersonCache']();
			const allPeople = Array.from(this.graphService['personCache'].values());

			if (allPeople.length === 0) {
				throw new Error(`No person notes found in folder: ${options.peopleFolder}`);
			}

			logger.info('export', `Loaded ${allPeople.length} people`);

			// Apply collection filter if specified
			let filteredPeople = allPeople;
			if (options.collectionFilter) {
				filteredPeople = allPeople.filter(person => {
					return person.collection === options.collectionFilter;
				});

				logger.info('export', `Filtered to ${filteredPeople.length} people in collection: ${options.collectionFilter}`);

				if (filteredPeople.length === 0) {
					throw new Error(`No people found in collection "${options.collectionFilter}".`);
				}
			}

			// Apply branch filter if specified
			if (options.branchRootCrId && options.branchDirection) {
				const branchPeople = options.branchDirection === 'ancestors'
					? this.graphService.getAncestors(options.branchRootCrId, true)
					: this.graphService.getDescendants(options.branchRootCrId, true, options.branchIncludeSpouses);

				const branchCrIds = new Set(branchPeople.map(p => p.crId));
				filteredPeople = filteredPeople.filter(p => branchCrIds.has(p.crId));

				logger.info('export', `Filtered to ${filteredPeople.length} people in ${options.branchDirection} branch`);

				if (filteredPeople.length === 0) {
					throw new Error(`No people found in ${options.branchDirection} branch.`);
				}
			}

			// Apply privacy filtering if enabled
			if (privacyService && options.privacySettings?.enablePrivacyProtection) {
				const beforeCount = filteredPeople.length;

				// Count obfuscated (living but not excluded)
				for (const person of filteredPeople) {
					const privacyResult = privacyService.applyPrivacy({
						name: person.name,
						birthDate: person.birthDate,
						deathDate: person.deathDate
					});
					if (privacyResult.isProtected && !privacyResult.excludeFromOutput) {
						result.privacyObfuscated = (result.privacyObfuscated || 0) + 1;
					}
				}

				// Filter out excluded people (privacy format = 'hidden')
				if (options.privacySettings.privacyDisplayFormat === 'hidden') {
					filteredPeople = filteredPeople.filter(person => {
						const privacyResult = privacyService.applyPrivacy({
							name: person.name,
							birthDate: person.birthDate,
							deathDate: person.deathDate
						});
						return !privacyResult.excludeFromOutput;
					});
					result.privacyExcluded = beforeCount - filteredPeople.length;
					logger.info('export', `Privacy: excluded ${result.privacyExcluded} living persons`);
				}
			}

			// Build GEDCOM X document
			new Notice('Generating GEDCOM X data...');
			const document = this.buildGedcomXDocument(
				filteredPeople,
				options,
				privacyService
			);

			// Serialize to JSON
			result.jsonContent = JSON.stringify(document, null, 2);
			result.personsExported = document.persons?.length || 0;
			result.relationshipsExported = document.relationships?.length || 0;
			result.success = true;

			new Notice(`Export complete: ${result.personsExported} people exported`);

		} catch (error: unknown) {
			const errorMsg = getErrorMessage(error);
			result.errors.push(`Export failed: ${errorMsg}`);
			logger.error('export', 'Export failed', error);
			new Notice(`Export failed: ${errorMsg}`);
		}

		return result;
	}

	/**
	 * Build complete GEDCOM X document
	 */
	private buildGedcomXDocument(
		people: PersonNode[],
		options: GedcomXExportOptions,
		privacyService: PrivacyService | null
	): GedcomXDocument {
		// Create ID mapping for relationships
		const crIdToGedcomXId = new Map<string, string>();
		people.forEach((person, index) => {
			crIdToGedcomXId.set(person.crId, `P${index + 1}`);
		});

		// Build persons
		const persons: GedcomXPerson[] = people.map(person => {
			return this.buildPerson(person, crIdToGedcomXId, privacyService);
		});

		// Build relationships
		const relationships = this.buildRelationships(people, crIdToGedcomXId);

		// Build source description
		const sourceDescriptions: GedcomXSourceDescription[] = [{
			id: 'S1',
			titles: [{
				value: `Export from ${options.sourceApp || 'Canvas Roots'}`
			}],
			citations: [{
				value: `Exported on ${new Date().toISOString()}`
			}]
		}];

		// Build agent (submitter)
		const agents: GedcomXAgent[] = [{
			id: 'A1',
			names: [{
				value: options.sourceApp || 'Canvas Roots'
			}]
		}];

		return {
			id: options.fileName || 'export',
			lang: 'en',
			description: '#S1',
			persons,
			relationships,
			sourceDescriptions,
			agents
		};
	}

	/**
	 * Build a GEDCOM X person from a PersonNode
	 */
	private buildPerson(
		person: PersonNode,
		crIdToGedcomXId: Map<string, string>,
		privacyService: PrivacyService | null
	): GedcomXPerson {
		const gedcomXId = crIdToGedcomXId.get(person.crId) || person.crId;

		// Check privacy status
		const privacyResult = privacyService?.applyPrivacy({
			name: person.name,
			birthDate: person.birthDate,
			deathDate: person.deathDate
		});

		// Determine display name
		const displayName = privacyResult?.isProtected
			? privacyResult.displayName
			: (person.name || 'Unknown');

		// Build name
		const names: GedcomXName[] = [{
			type: GEDCOMX_TYPES.BIRTH_NAME,
			nameForms: [{
				fullText: displayName,
				parts: this.parseNameParts(displayName, privacyResult?.isProtected || false)
			}],
			preferred: true
		}];

		// Build facts
		const facts: GedcomXFact[] = [];

		// Birth fact (hide if protected and configured)
		const showBirthDetails = !privacyResult?.isProtected || privacyResult.showBirthDate;
		if (showBirthDetails && (person.birthDate || person.birthPlace)) {
			const birthFact: GedcomXFact = {
				type: GEDCOMX_TYPES.BIRTH
			};
			if (person.birthDate) {
				birthFact.date = {
					original: person.birthDate,
					formal: this.formatFormalDate(person.birthDate)
				};
			}
			if (person.birthPlace) {
				birthFact.place = {
					original: person.birthPlace
				};
			}
			facts.push(birthFact);
		}

		// Death fact
		if (person.deathDate || person.deathPlace) {
			const deathFact: GedcomXFact = {
				type: GEDCOMX_TYPES.DEATH
			};
			if (person.deathDate) {
				deathFact.date = {
					original: person.deathDate,
					formal: this.formatFormalDate(person.deathDate)
				};
			}
			if (person.deathPlace) {
				deathFact.place = {
					original: person.deathPlace
				};
			}
			facts.push(deathFact);
		}

		// Burial fact
		if (person.burialPlace) {
			facts.push({
				type: GEDCOMX_TYPES.BURIAL,
				place: {
					original: person.burialPlace
				}
			});
		}

		// Occupation fact
		if (person.occupation) {
			facts.push({
				type: GEDCOMX_TYPES.OCCUPATION,
				value: person.occupation
			});
		}

		// Build gender
		const gender = this.convertGender(person.sex);

		// Build the person record
		const gedcomXPerson: GedcomXPerson = {
			id: gedcomXId,
			names,
			living: privacyResult?.isProtected || false
		};

		if (gender) {
			gedcomXPerson.gender = { type: gender };
		}

		if (facts.length > 0) {
			gedcomXPerson.facts = facts;
		}

		// Add identifiers (including original cr_id)
		gedcomXPerson.identifiers = {
			'http://gedcomx.org/Primary': [person.crId]
		};

		return gedcomXPerson;
	}

	/**
	 * Build relationships from people
	 */
	private buildRelationships(
		people: PersonNode[],
		crIdToGedcomXId: Map<string, string>
	): GedcomXRelationship[] {
		const relationships: GedcomXRelationship[] = [];
		const addedRelationships = new Set<string>();

		let relationshipCounter = 1;

		for (const person of people) {
			const personId = crIdToGedcomXId.get(person.crId);
			if (!personId) continue;

			// Parent-child relationships (person is child)
			if (person.fatherCrId) {
				const fatherId = crIdToGedcomXId.get(person.fatherCrId);
				if (fatherId) {
					const key = `PC:${fatherId}:${personId}`;
					if (!addedRelationships.has(key)) {
						relationships.push({
							id: `R${relationshipCounter++}`,
							type: GEDCOMX_TYPES.PARENT_CHILD,
							person1: { resource: `#${fatherId}` },
							person2: { resource: `#${personId}` }
						});
						addedRelationships.add(key);
					}
				}
			}

			if (person.motherCrId) {
				const motherId = crIdToGedcomXId.get(person.motherCrId);
				if (motherId) {
					const key = `PC:${motherId}:${personId}`;
					if (!addedRelationships.has(key)) {
						relationships.push({
							id: `R${relationshipCounter++}`,
							type: GEDCOMX_TYPES.PARENT_CHILD,
							person1: { resource: `#${motherId}` },
							person2: { resource: `#${personId}` }
						});
						addedRelationships.add(key);
					}
				}
			}

			// Couple relationships
			if (person.spouseCrIds && person.spouseCrIds.length > 0) {
				for (const spouseId of person.spouseCrIds) {
					const spouseGedcomXId = crIdToGedcomXId.get(spouseId);
					if (spouseGedcomXId) {
						// Use sorted IDs to avoid duplicates
						const [id1, id2] = [personId, spouseGedcomXId].sort();
						const key = `C:${id1}:${id2}`;
						if (!addedRelationships.has(key)) {
							const relationship: GedcomXRelationship = {
								id: `R${relationshipCounter++}`,
								type: GEDCOMX_TYPES.COUPLE,
								person1: { resource: `#${id1}` },
								person2: { resource: `#${id2}` }
							};

							// Add marriage facts if available from enhanced spouse data
							if (person.spouses) {
								const spouseData = person.spouses.find(
									(s: { personId: string; marriageDate?: string; marriageLocation?: string }) => s.personId === spouseId
								);
								if (spouseData && (spouseData.marriageDate || spouseData.marriageLocation)) {
									const marriageFact: GedcomXFact = {
										type: GEDCOMX_TYPES.MARRIAGE
									};
									if (spouseData.marriageDate) {
										marriageFact.date = {
											original: spouseData.marriageDate,
											formal: this.formatFormalDate(spouseData.marriageDate)
										};
									}
									if (spouseData.marriageLocation) {
										marriageFact.place = {
											original: spouseData.marriageLocation
										};
									}
									relationship.facts = [marriageFact];
								}
							}

							relationships.push(relationship);
							addedRelationships.add(key);
						}
					}
				}
			}
		}

		return relationships;
	}

	/**
	 * Parse name parts from a full name
	 */
	private parseNameParts(
		fullName: string,
		isProtected: boolean
	): { type?: string; value: string }[] {
		if (isProtected) {
			// For protected names, return as single name part
			return [{ value: fullName }];
		}

		const parts: { type?: string; value: string }[] = [];
		const nameParts = fullName.trim().split(/\s+/);

		if (nameParts.length === 1) {
			parts.push({ value: nameParts[0] });
		} else if (nameParts.length >= 2) {
			// Assume last part is surname
			const surname = nameParts.pop()!;
			const given = nameParts.join(' ');

			if (given) {
				parts.push({
					type: 'http://gedcomx.org/Given',
					value: given
				});
			}
			parts.push({
				type: 'http://gedcomx.org/Surname',
				value: surname
			});
		}

		return parts;
	}

	/**
	 * Convert internal sex format to GEDCOM X gender type
	 */
	private convertGender(sex?: string): string | null {
		if (!sex) return null;

		const normalized = sex.toUpperCase();
		if (normalized === 'M' || normalized === 'MALE') {
			return GEDCOMX_TYPES.MALE;
		}
		if (normalized === 'F' || normalized === 'FEMALE') {
			return GEDCOMX_TYPES.FEMALE;
		}

		return GEDCOMX_TYPES.UNKNOWN;
	}

	/**
	 * Format a date string to GEDCOM X formal date format
	 * Basic implementation - handles YYYY, YYYY-MM, YYYY-MM-DD
	 */
	private formatFormalDate(dateString: string): string | undefined {
		if (!dateString) return undefined;

		// Try to extract a 4-digit year
		const yearMatch = dateString.match(/\b(1[89][0-9]{2}|20[0-9]{2})\b/);
		if (!yearMatch) return undefined;

		const year = yearMatch[1];

		// Check for ISO format YYYY-MM-DD
		const isoMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/);
		if (isoMatch) {
			return `+${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
		}

		// Check for YYYY-MM format
		const yearMonthMatch = dateString.match(/^(\d{4})-(\d{2})$/);
		if (yearMonthMatch) {
			return `+${yearMonthMatch[1]}-${yearMonthMatch[2]}`;
		}

		// Return just the year
		return `+${year}`;
	}
}
