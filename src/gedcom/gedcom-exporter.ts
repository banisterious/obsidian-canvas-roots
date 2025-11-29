/**
 * GEDCOM Exporter for Canvas Roots
 *
 * Exports person notes from Obsidian vault to GEDCOM 5.5.1 format.
 */

import { App, Notice } from 'obsidian';
import { FamilyGraphService, type PersonNode } from '../core/family-graph';
import { getLogger } from '../core/logging';
import { getErrorMessage } from '../core/error-utils';
import { PrivacyService, type PrivacySettings } from '../core/privacy-service';

const logger = getLogger('GedcomExporter');

/**
 * GEDCOM export options
 */
export interface GedcomExportOptions {
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

	/** Include collection codes in GEDCOM output */
	includeCollectionCodes?: boolean;

	/** Export filename (without .ged extension) */
	fileName?: string;

	/** Source application identifier for GEDCOM header */
	sourceApp?: string;

	/** Source version for GEDCOM header */
	sourceVersion?: string;

	/** Privacy settings for protecting living persons */
	privacySettings?: PrivacySettings;
}

/**
 * GEDCOM export result
 */
export interface GedcomExportResult {
	success: boolean;
	individualsExported: number;
	familiesExported: number;
	errors: string[];
	gedcomContent?: string;
	fileName: string;
	/** Number of living persons excluded due to privacy settings */
	privacyExcluded?: number;
	/** Number of living persons with obfuscated data */
	privacyObfuscated?: number;
}

/**
 * Internal representation of a GEDCOM family record
 */
interface GedcomFamilyRecord {
	id: string;
	husbandId?: string;
	wifeId?: string;
	childIds: string[];
	marriageDate?: string;
	marriagePlace?: string;
}

/**
 * Export person notes to GEDCOM format
 */
export class GedcomExporter {
	private app: App;
	private graphService: FamilyGraphService;

	constructor(app: App) {
		this.app = app;
		this.graphService = new FamilyGraphService(app);
	}

	/**
	 * Export people to GEDCOM format
	 */
	exportToGedcom(options: GedcomExportOptions): GedcomExportResult {
		const result: GedcomExportResult = {
			success: false,
			individualsExported: 0,
			familiesExported: 0,
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
					throw new Error(`No people found in collection "${options.collectionFilter}". Found ${allPeople.length} total people, but none match this collection.`);
				}
			}

			// Apply branch filter if specified
			if (options.branchRootCrId && options.branchDirection) {
				const branchPeople = options.branchDirection === 'ancestors'
					? this.graphService.getAncestors(options.branchRootCrId, true)
					: this.graphService.getDescendants(options.branchRootCrId, true, options.branchIncludeSpouses);

				const branchCrIds = new Set(branchPeople.map(p => p.crId));
				filteredPeople = filteredPeople.filter(p => branchCrIds.has(p.crId));

				logger.info('export', `Filtered to ${filteredPeople.length} people in ${options.branchDirection} branch of ${options.branchRootCrId}`);

				if (filteredPeople.length === 0) {
					throw new Error(`No people found in ${options.branchDirection} branch. The branch root may not exist or has no ${options.branchDirection}.`);
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

				if (result.privacyObfuscated && result.privacyObfuscated > 0) {
					logger.info('export', `Privacy: obfuscating ${result.privacyObfuscated} living persons`);
				}
			}

			// Build GEDCOM content
			new Notice('Generating GEDCOM data...');
			const gedcomContent = this.buildGedcomContent(
				filteredPeople,
				options,
				privacyService
			);

			// Count families
			const families = this.extractFamilies(filteredPeople, new Map());

			result.gedcomContent = gedcomContent;
			result.individualsExported = filteredPeople.length;
			result.familiesExported = families.length;
			result.success = true;

			new Notice(`Export complete: ${result.individualsExported} people exported`);

		} catch (error: unknown) {
			const errorMsg = getErrorMessage(error);
			result.errors.push(`Export failed: ${errorMsg}`);
			logger.error('export', 'Export failed', error);
			new Notice(`Export failed: ${errorMsg}`);
		}

		return result;
	}

	/**
	 * Build complete GEDCOM content
	 */
	private buildGedcomContent(
		people: PersonNode[],
		options: GedcomExportOptions,
		privacyService: PrivacyService | null
	): string {
		const lines: string[] = [];

		// Build header
		lines.push(...this.buildHeader(options));

		// Build individual records
		const crIdToGedcomId = new Map<string, string>();
		let individualCounter = 1;

		for (const person of people) {
			const gedcomId = `I${individualCounter}`;
			crIdToGedcomId.set(person.crId, gedcomId);
			individualCounter++;
		}

		for (const person of people) {
			const gedcomId = crIdToGedcomId.get(person.crId);
			if (!gedcomId) continue;

			lines.push(...this.buildIndividualRecord(
				person,
				gedcomId,
				crIdToGedcomId,
				options,
				privacyService
			));
		}

		// Build family records
		const families = this.extractFamilies(people, crIdToGedcomId);

		let familyCounter = 1;
		for (const family of families) {
			const familyId = `F${familyCounter}`;
			lines.push(...this.buildFamilyRecord(family, familyId));
			familyCounter++;
		}

		// Build trailer
		lines.push('0 TRLR');

		return lines.join('\n');
	}

	/**
	 * Build GEDCOM header
	 */
	private buildHeader(options: GedcomExportOptions): string[] {
		const now = new Date();
		const dateStr = `${now.getDate()} ${this.getMonthAbbreviation(now.getMonth())} ${now.getFullYear()}`;
		const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

		const sourceApp = options.sourceApp || 'Canvas Roots';
		const sourceVersion = options.sourceVersion || '0.1.3-alpha';

		return [
			'0 HEAD',
			'1 SOUR ' + sourceApp,
			`2 VERS ${sourceVersion}`,
			'2 NAME Canvas Roots for Obsidian',
			'1 DEST ANY',
			'1 DATE ' + dateStr,
			`2 TIME ${timeStr}`,
			'1 SUBM @SUBM1@',
			'1 FILE ' + (options.fileName || 'export') + '.ged',
			'1 GEDC',
			'2 VERS 5.5.1',
			'2 FORM LINEAGE-LINKED',
			'1 CHAR UTF-8',
			'0 @SUBM1@ SUBM',
			'1 NAME Canvas Roots User'
		];
	}

	/**
	 * Build individual record
	 */
	private buildIndividualRecord(
		person: PersonNode,
		gedcomId: string,
		_crIdToGedcomId: Map<string, string>,
		options: GedcomExportOptions,
		privacyService: PrivacyService | null
	): string[] {
		const lines: string[] = [];

		// Check privacy status
		const privacyResult = privacyService?.applyPrivacy({
			name: person.name,
			birthDate: person.birthDate,
			deathDate: person.deathDate
		});

		lines.push(`0 @${gedcomId}@ INDI`);

		// Name (possibly obfuscated)
		const displayName = privacyResult?.isProtected
			? privacyResult.displayName
			: (person.name || 'Unknown');
		const gedcomName = this.formatNameForGedcom(displayName);
		lines.push(`1 NAME ${gedcomName}`);

		// Parse given/surname if possible (only if not obfuscated)
		if (!privacyResult?.isProtected) {
			const nameParts = this.parseNameParts(displayName);
			if (nameParts.given) {
				lines.push(`2 GIVN ${nameParts.given}`);
			}
			if (nameParts.surname) {
				lines.push(`2 SURN ${nameParts.surname}`);
			}
		}

		// Sex (infer from relationships or default to unknown)
		const sex = this.inferSex(person);
		if (sex) {
			lines.push(`1 SEX ${sex}`);
		}

		// Birth (hide if protected and hideDetailsForLiving is enabled)
		const showBirthDetails = !privacyResult?.isProtected || privacyResult.showBirthDate;
		if (showBirthDetails && (person.birthDate || person.birthPlace)) {
			lines.push('1 BIRT');
			if (person.birthDate && (!privacyResult?.isProtected || privacyResult.showBirthDate)) {
				const birthDate = this.formatDateForGedcom(person.birthDate);
				if (birthDate) {
					lines.push(`2 DATE ${birthDate}`);
				}
			}
			if (person.birthPlace && (!privacyResult?.isProtected || privacyResult.showBirthPlace)) {
				lines.push(`2 PLAC ${person.birthPlace}`);
			}
		}

		// Death (always show - living persons won't have death data anyway)
		if (person.deathDate || person.deathPlace) {
			lines.push('1 DEAT');
			if (person.deathDate) {
				const deathDate = this.formatDateForGedcom(person.deathDate);
				if (deathDate) {
					lines.push(`2 DATE ${deathDate}`);
				}
			}
			if (person.deathPlace) {
				lines.push(`2 PLAC ${person.deathPlace}`);
			}
		}

		// Occupation (hide for protected persons)
		if (person.occupation && !privacyResult?.isProtected) {
			lines.push(`1 OCCU ${person.occupation}`);
		}

		// UUID preservation using _UID custom tag
		lines.push(`1 _UID ${person.crId}`);

		// Collection codes if enabled
		if (options.includeCollectionCodes) {
			if (person.collection) {
				lines.push(`1 _COLL ${person.collection}`);
			}
			if (person.collectionName) {
				lines.push(`1 _COLLN ${person.collectionName}`);
			}
		}

		return lines;
	}

	/**
	 * Build family record
	 */
	private buildFamilyRecord(
		family: GedcomFamilyRecord,
		familyId: string
	): string[] {
		const lines: string[] = [];

		lines.push(`0 @${familyId}@ FAM`);

		if (family.husbandId) {
			lines.push(`1 HUSB @${family.husbandId}@`);
		}

		if (family.wifeId) {
			lines.push(`1 WIFE @${family.wifeId}@`);
		}

		for (const childId of family.childIds) {
			lines.push(`1 CHIL @${childId}@`);
		}

		if (family.marriageDate || family.marriagePlace) {
			lines.push('1 MARR');

			if (family.marriageDate) {
				const marriageDate = this.formatDateForGedcom(family.marriageDate);
				if (marriageDate) {
					lines.push(`2 DATE ${marriageDate}`);
				}
			}

			if (family.marriagePlace) {
				lines.push(`2 PLAC ${family.marriagePlace}`);
			}
		}

		return lines;
	}

	/**
	 * Extract family records from person nodes
	 */
	private extractFamilies(
		people: PersonNode[],
		crIdToGedcomId: Map<string, string>
	): GedcomFamilyRecord[] {
		const families: GedcomFamilyRecord[] = [];
		const processedFamilies = new Set<string>();

		// Build families from parent-child relationships
		for (const person of people) {
			if (person.fatherCrId || person.motherCrId) {
				const familyKey = `${person.fatherCrId || 'NONE'}_${person.motherCrId || 'NONE'}`;

				if (!processedFamilies.has(familyKey)) {
					const family: GedcomFamilyRecord = {
						id: `F${families.length + 1}`,
						childIds: [],
						husbandId: person.fatherCrId ? crIdToGedcomId.get(person.fatherCrId) : undefined,
						wifeId: person.motherCrId ? crIdToGedcomId.get(person.motherCrId) : undefined
					};

					// Find all children of this family
					for (const child of people) {
						if (child.fatherCrId === person.fatherCrId && child.motherCrId === person.motherCrId) {
							const childGedcomId = crIdToGedcomId.get(child.crId);
							if (childGedcomId) {
								family.childIds.push(childGedcomId);
							}
						}
					}

					families.push(family);
					processedFamilies.add(familyKey);
				}
			}
		}

		// Build families from spouse relationships (marriages without children)
		for (const person of people) {
			if (person.spouseCrIds && person.spouseCrIds.length > 0) {
				for (const spouseCrId of person.spouseCrIds) {
					// Check if this spouse relationship already has a family
					const hasFamily = families.some(f =>
						(f.husbandId === crIdToGedcomId.get(person.crId) && f.wifeId === crIdToGedcomId.get(spouseCrId)) ||
						(f.wifeId === crIdToGedcomId.get(person.crId) && f.husbandId === crIdToGedcomId.get(spouseCrId))
					);

					if (!hasFamily) {
						// Determine husband/wife based on inferred sex
						const personSex = this.inferSex(person, people);
						const spouse = people.find(p => p.crId === spouseCrId);
						const spouseSex = spouse ? this.inferSex(spouse, people) : undefined;

						const family: GedcomFamilyRecord = {
							id: `F${families.length + 1}`,
							childIds: [],
							husbandId: personSex === 'M' ? crIdToGedcomId.get(person.crId) :
								spouseSex === 'M' ? crIdToGedcomId.get(spouseCrId) :
								crIdToGedcomId.get(person.crId),
							wifeId: personSex === 'F' ? crIdToGedcomId.get(person.crId) :
								spouseSex === 'F' ? crIdToGedcomId.get(spouseCrId) :
								crIdToGedcomId.get(spouseCrId)
						};

						// Extract marriage metadata if available
						if (person.spouses) {
							const spouseRelationship = person.spouses.find(s => s.personId === spouseCrId);
							if (spouseRelationship) {
								family.marriageDate = spouseRelationship.marriageDate;
								family.marriagePlace = spouseRelationship.marriageLocation;
							}
						}

						families.push(family);
					}
				}
			}
		}

		return families;
	}

	/**
	 * Format name for GEDCOM (surname in slashes)
	 */
	private formatNameForGedcom(name: string): string {
		if (!name || typeof name !== 'string') {
			logger.warn('name-format', 'Invalid or missing name, using "Unknown"');
			return 'Unknown //';
		}

		const trimmed = name.trim();
		if (trimmed.length === 0) {
			return 'Unknown //';
		}

		const parts = trimmed.split(/\s+/);

		if (parts.length === 0 || parts[0].length === 0) {
			return 'Unknown //';
		}

		if (parts.length === 1) {
			return `${parts[0]} //`;
		}

		// Assume last part is surname
		const surname = parts[parts.length - 1];
		const givenNames = parts.slice(0, -1).join(' ');

		return `${givenNames} /${surname}/`;
	}

	/**
	 * Parse name into given/surname parts
	 */
	private parseNameParts(name: string): { given?: string; surname?: string } {
		const parts = name.trim().split(/\s+/);

		if (parts.length === 0) {
			return {};
		}

		if (parts.length === 1) {
			return { given: parts[0] };
		}

		// Assume last part is surname
		return {
			given: parts.slice(0, -1).join(' '),
			surname: parts[parts.length - 1]
		};
	}

	/**
	 * Infer sex from relationships or return undefined
	 * Note: This requires access to all people, so it's used during export
	 */
	private inferSex(person: PersonNode, allPeople?: PersonNode[]): 'M' | 'F' | undefined {
		// Check if sex is already recorded
		if (person.sex === 'M' || person.sex === 'F') {
			return person.sex;
		}

		if (!allPeople) return undefined;

		// Check if person is a father
		const isFather = allPeople.some(p => p.fatherCrId === person.crId);
		if (isFather) return 'M';

		// Check if person is a mother
		const isMother = allPeople.some(p => p.motherCrId === person.crId);
		if (isMother) return 'F';

		// Cannot infer sex
		return undefined;
	}

	/**
	 * Format date for GEDCOM (DD MMM YYYY)
	 */
	private formatDateForGedcom(isoDate: string): string | undefined {
		if (!isoDate) return undefined;

		// Parse ISO date (YYYY-MM-DD or variations)
		const match = isoDate.match(/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/);
		if (!match) {
			logger.warn('date-format', `Invalid date format for GEDCOM: ${isoDate}`);
			return undefined;
		}

		const year = match[1];
		const month = match[2];
		const day = match[3];

		if (!month) {
			// Year only
			return year;
		}

		const monthNum = parseInt(month);
		if (monthNum < 1 || monthNum > 12) {
			logger.warn('date-format', `Invalid month value: ${month} in date ${isoDate}`);
			return year; // Fallback to year only
		}

		const monthAbbr = this.getMonthAbbreviation(monthNum - 1);

		if (!day) {
			// Month and year
			return `${monthAbbr} ${year}`;
		}

		const dayNum = parseInt(day);
		if (dayNum < 1 || dayNum > 31) {
			logger.warn('date-format', `Invalid day value: ${day} in date ${isoDate}`);
			return `${monthAbbr} ${year}`; // Fallback to month and year
		}

		// Full date
		return `${dayNum} ${monthAbbr} ${year}`;
	}

	/**
	 * Get month abbreviation for GEDCOM
	 */
	private getMonthAbbreviation(monthIndex: number): string {
		const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
			'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
		return months[monthIndex] || 'JAN';
	}
}
