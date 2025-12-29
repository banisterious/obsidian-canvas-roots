/**
 * GEDCOM Exporter for Canvas Roots
 *
 * Exports person notes from Obsidian vault to GEDCOM 5.5.1 format.
 */

import { App, Notice } from 'obsidian';
import { FamilyGraphService, type PersonNode } from '../core/family-graph';
import { FolderFilterService } from '../core/folder-filter';
import { getLogger } from '../core/logging';
import { getErrorMessage } from '../core/error-utils';
import { PrivacyService, type PrivacySettings } from '../core/privacy-service';
import { PropertyAliasService } from '../core/property-alias-service';
import { ValueAliasService } from '../core/value-alias-service';
import { EventService } from '../events/services/event-service';
import type { EventNote } from '../events/types/event-types';
import { SourceService } from '../sources/services/source-service';
import type { SourceNote } from '../sources/types/source-types';
import { PlaceGraphService } from '../core/place-graph';
import type { PlaceNode } from '../models/place';
import type { CanvasRootsSettings } from '../settings';
import { RelationshipService } from '../relationships/services/relationship-service';
import { extractWikilinkPath } from '../utils/wikilink-resolver';

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

	/** Include custom relationships as ASSO records */
	includeCustomRelationships?: boolean;

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
	/** Pedigree type for child relationships: 'birth' (default), 'step', 'adop' */
	pediType?: 'birth' | 'step' | 'adop';
}

/**
 * FAMC reference with optional pedigree type
 */
interface FamcReference {
	familyId: string;
	pediType?: 'birth' | 'step' | 'adop';
}

/**
 * Export person notes to GEDCOM format
 */
export class GedcomExporter {
	private app: App;
	private graphService: FamilyGraphService;
	private eventService: EventService | null = null;
	private sourceService: SourceService | null = null;
	private placeGraphService: PlaceGraphService | null = null;
	private propertyAliasService: PropertyAliasService | null = null;
	private valueAliasService: ValueAliasService | null = null;
	private relationshipService: RelationshipService | null = null;

	constructor(app: App, folderFilter?: FolderFilterService) {
		this.app = app;
		this.graphService = new FamilyGraphService(app);
		if (folderFilter) {
			this.graphService.setFolderFilter(folderFilter);
		}
	}

	/**
	 * Set event service for loading event notes
	 */
	setEventService(settings: CanvasRootsSettings): void {
		this.eventService = new EventService(this.app, settings);
	}

	/**
	 * Set source service for loading source notes
	 */
	setSourceService(settings: CanvasRootsSettings): void {
		this.sourceService = new SourceService(this.app, settings);
	}

	/**
	 * Set place graph service for loading place notes
	 */
	setPlaceGraphService(settings: CanvasRootsSettings): void {
		this.placeGraphService = new PlaceGraphService(this.app);
		this.placeGraphService.setSettings(settings);
		if (settings.valueAliases) {
			this.placeGraphService.setValueAliases(settings.valueAliases);
		}
	}

	/**
	 * Set property alias service for resolving custom property names
	 */
	setPropertyAliasService(service: PropertyAliasService): void {
		this.propertyAliasService = service;
	}

	/**
	 * Set value alias service for resolving custom property values
	 */
	setValueAliasService(service: ValueAliasService): void {
		this.valueAliasService = service;
	}

	/**
	 * Set relationship service for loading custom relationships
	 */
	setRelationshipService(service: RelationshipService): void {
		this.relationshipService = service;
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

			// Load events if event service is available
			let allEvents: EventNote[] = [];
			if (this.eventService) {
				new Notice('Loading event notes...');
				allEvents = this.eventService.getAllEvents();
				logger.info('export', `Loaded ${allEvents.length} events`);
			}

			// Load sources if source service is available
			let allSources: SourceNote[] = [];
			if (this.sourceService) {
				new Notice('Loading source notes...');
				allSources = this.sourceService.getAllSources();
				logger.info('export', `Loaded ${allSources.length} sources`);
			}

			// Load places if place graph service is available
			let allPlaces: PlaceNode[] = [];
			if (this.placeGraphService) {
				new Notice('Loading place notes...');
				allPlaces = this.placeGraphService.getAllPlaces();
				logger.info('export', `Loaded ${allPlaces.length} places`);
			}

			// Build GEDCOM content
			new Notice('Generating GEDCOM data...');
			const gedcomContent = this.buildGedcomContent(
				filteredPeople,
				allEvents,
				allSources,
				allPlaces,
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
		events: EventNote[],
		sources: SourceNote[],
		places: PlaceNode[],
		options: GedcomExportOptions,
		privacyService: PrivacyService | null
	): string {
		const lines: string[] = [];

		// Build header
		lines.push(...this.buildHeader(options));

		// Build source records
		const sourceIdMap = new Map<string, string>();
		let sourceCounter = 1;

		for (const source of sources) {
			const sourceId = `S${sourceCounter}`;
			sourceIdMap.set(source.crId, sourceId);
			lines.push(...this.buildSourceRecord(source, sourceId));
			sourceCounter++;
		}

		// Build individual ID map first
		const crIdToGedcomId = new Map<string, string>();
		let individualCounter = 1;

		for (const person of people) {
			const gedcomId = `I${individualCounter}`;
			crIdToGedcomId.set(person.crId, gedcomId);
			individualCounter++;
		}

		// Extract families BEFORE building individual records (needed for FAMS/FAMC references)
		const families = this.extractFamilies(people, crIdToGedcomId);

		// Assign family IDs and build lookup maps
		const familyIdMap = new Map<GedcomFamilyRecord, string>();
		let familyCounter = 1;
		for (const family of families) {
			const familyId = `F${familyCounter}`;
			familyIdMap.set(family, familyId);
			familyCounter++;
		}

		// Build FAMS lookup (person GEDCOM ID -> family IDs where they are a spouse)
		const famsLookup = new Map<string, string[]>();
		// Build FAMC lookup (person GEDCOM ID -> family references where they are a child)
		const famcLookup = new Map<string, FamcReference[]>();

		for (const [family, familyId] of familyIdMap) {
			// FAMS: families where person is husband or wife
			if (family.husbandId) {
				const existing = famsLookup.get(family.husbandId) || [];
				existing.push(familyId);
				famsLookup.set(family.husbandId, existing);
			}
			if (family.wifeId) {
				const existing = famsLookup.get(family.wifeId) || [];
				existing.push(familyId);
				famsLookup.set(family.wifeId, existing);
			}

			// FAMC: family where person is a child (with pedigree type)
			for (const childId of family.childIds) {
				const existing = famcLookup.get(childId) || [];
				existing.push({
					familyId,
					pediType: family.pediType
				});
				famcLookup.set(childId, existing);
			}
		}

		// Build individual records with FAMS/FAMC references
		for (const person of people) {
			const gedcomId = crIdToGedcomId.get(person.crId);
			if (!gedcomId) continue;

			lines.push(...this.buildIndividualRecord(
				person,
				gedcomId,
				crIdToGedcomId,
				events,
				sourceIdMap,
				options,
				privacyService,
				famsLookup.get(gedcomId),
				famcLookup.get(gedcomId)
			));
		}

		// Build family records
		for (const [family, familyId] of familyIdMap) {
			lines.push(...this.buildFamilyRecord(family, familyId));
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
	 * Build source record
	 */
	private buildSourceRecord(source: SourceNote, sourceId: string): string[] {
		const lines: string[] = [];

		lines.push(`0 @${sourceId}@ SOUR`);

		// Title
		if (source.title) {
			lines.push(`1 TITL ${source.title}`);
		}

		// Repository (mapped to AUTH in GEDCOM 5.5.1)
		if (source.repository) {
			lines.push(`1 AUTH ${source.repository}`);
		}

		// Collection (mapped to PUBL in GEDCOM 5.5.1)
		if (source.collection) {
			lines.push(`1 PUBL ${source.collection}`);
		}

		// Date of original document
		if (source.date) {
			const gedcomDate = this.formatDateForGedcom(source.date);
			if (gedcomDate) {
				lines.push(`1 DATA`);
				lines.push(`2 DATE ${gedcomDate}`);
			}
		}

		// Repository URL as note
		if (source.repositoryUrl) {
			lines.push(`1 NOTE ${source.repositoryUrl}`);
		}

		return lines;
	}

	/**
	 * Build hierarchical place string from place node
	 * Returns comma-separated hierarchy from specific to general (e.g., "Dublin, Dublin County, Leinster, Ireland")
	 */
	private buildPlaceHierarchy(placeNode: PlaceNode): string {
		if (!this.placeGraphService) {
			return placeNode.name;
		}

		const hierarchy = this.placeGraphService.getHierarchyPath(placeNode.id);
		return hierarchy.map(p => p.name).join(', ');
	}

	/**
	 * Build place lines with hierarchy and coordinates
	 * Returns GEDCOM lines for a place (PLAC, FORM, MAP with LATI/LONG)
	 */
	private buildPlaceLines(placeName: string, level: number): string[] {
		const lines: string[] = [];

		// If no place graph service, just output simple place name
		if (!this.placeGraphService) {
			lines.push(`${level} PLAC ${placeName}`);
			return lines;
		}

		// Try to find the place by name
		const placeNode = this.placeGraphService.getPlaceByName(placeName);

		if (!placeNode) {
			// Place not found in graph - output as-is
			lines.push(`${level} PLAC ${placeName}`);
			return lines;
		}

		// Build hierarchical place name
		const hierarchyString = this.buildPlaceHierarchy(placeNode);
		lines.push(`${level} PLAC ${hierarchyString}`);

		// Add FORM to indicate hierarchy structure (if there's a hierarchy)
		const hierarchy = this.placeGraphService.getHierarchyPath(placeNode.id);
		if (hierarchy.length > 1) {
			const formParts = hierarchy.map(p => p.placeType || 'Place');
			lines.push(`${level + 1} FORM ${formParts.join(', ')}`);
		}

		// Add MAP record with coordinates if available
		if (placeNode.coordinates) {
			lines.push(`${level + 1} MAP`);

			// Format latitude with N/S prefix
			const latPrefix = placeNode.coordinates.lat >= 0 ? 'N' : 'S';
			const latValue = Math.abs(placeNode.coordinates.lat).toFixed(4);
			lines.push(`${level + 2} LATI ${latPrefix}${latValue}`);

			// Format longitude with E/W prefix
			const longPrefix = placeNode.coordinates.long >= 0 ? 'E' : 'W';
			const longValue = Math.abs(placeNode.coordinates.long).toFixed(4);
			lines.push(`${level + 2} LONG ${longPrefix}${longValue}`);
		}

		return lines;
	}

	/**
	 * Build individual record
	 */
	private buildIndividualRecord(
		person: PersonNode,
		gedcomId: string,
		_crIdToGedcomId: Map<string, string>,
		events: EventNote[],
		sourceIdMap: Map<string, string>,
		options: GedcomExportOptions,
		privacyService: PrivacyService | null,
		famsIds?: string[],
		famcRefs?: FamcReference[]
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

		// Sex (resolve using alias services, infer from relationships if not found)
		const sex = this.resolveSexValue(person);
		if (sex) {
			lines.push(`1 SEX ${sex}`);
		}

		// Gender identity (custom tag for gender identity, distinct from biological sex)
		const genderIdentity = this.resolveGenderIdentityValue(person);
		if (genderIdentity && !privacyResult?.isProtected) {
			lines.push(`1 EVEN ${genderIdentity}`);
			lines.push('2 TYPE Gender Identity');
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
				lines.push(...this.buildPlaceLines(person.birthPlace, 2));
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
				lines.push(...this.buildPlaceLines(person.deathPlace, 2));
			}
		}

		// Occupation (hide for protected persons)
		if (person.occupation && !privacyResult?.isProtected) {
			lines.push(`1 OCCU ${person.occupation}`);
		}

		// Add events linked to this person
		if (events.length > 0) {
			const eventLines = this.buildEventRecords(person, events, sourceIdMap);
			lines.push(...eventLines);
		}

		// Add custom relationships as ASSO records
		if (options.includeCustomRelationships && this.relationshipService) {
			const assoLines = this.buildAssoRecords(person, _crIdToGedcomId);
			lines.push(...assoLines);
		}

		// FAMS - families where this person is a spouse
		if (famsIds && famsIds.length > 0) {
			for (const famsId of famsIds) {
				lines.push(`1 FAMS @${famsId}@`);
			}
		}

		// FAMC - families where this person is a child (with pedigree type)
		if (famcRefs && famcRefs.length > 0) {
			for (const famcRef of famcRefs) {
				lines.push(`1 FAMC @${famcRef.familyId}@`);
				// Add PEDI tag for non-biological relationships
				if (famcRef.pediType && famcRef.pediType !== 'birth') {
					lines.push(`2 PEDI ${famcRef.pediType}`);
				}
			}
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

		// Research level (0-6 based on Hoitink's Six Levels)
		if (person.researchLevel !== undefined) {
			lines.push(`1 _RESEARCH_LEVEL ${person.researchLevel}`);
		}

		return lines;
	}

	/**
	 * Build ASSO (association) records for custom relationships
	 */
	private buildAssoRecords(person: PersonNode, crIdToGedcomId: Map<string, string>): string[] {
		const lines: string[] = [];

		if (!this.relationshipService) {
			return lines;
		}

		// Get all relationships for this person (only defined ones, not inferred)
		const relationships = this.relationshipService.getRelationshipsForPerson(person.crId);
		const definedRelationships = relationships.filter(r => !r.isInferred);

		for (const rel of definedRelationships) {
			// Skip if target person is not in the export
			if (!rel.targetCrId || !crIdToGedcomId.has(rel.targetCrId)) {
				continue;
			}

			const targetGedcomId = crIdToGedcomId.get(rel.targetCrId)!;

			// Build ASSO record
			lines.push(`1 ASSO @${targetGedcomId}@`);

			// RELA (relationship descriptor)
			// Use the relationship type name as the RELA value
			lines.push(`2 RELA ${rel.type.name}`);

			// Add notes with additional information
			const noteLines: string[] = [];

			// Add date range if present
			if (rel.from || rel.to) {
				let dateNote = 'Relationship';
				if (rel.from && rel.to) {
					dateNote += ` from ${rel.from} to ${rel.to}`;
				} else if (rel.from) {
					dateNote += ` from ${rel.from}`;
				} else if (rel.to) {
					dateNote += ` until ${rel.to}`;
				}
				noteLines.push(dateNote);
			}

			// Add custom notes if present
			if (rel.notes) {
				noteLines.push(rel.notes);
			}

			// Write NOTE records
			if (noteLines.length > 0) {
				for (const note of noteLines) {
					lines.push(`2 NOTE ${note}`);
				}
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
				lines.push(...this.buildPlaceLines(family.marriagePlace, 2));
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

		// Build families from step-parent relationships
		const processedStepFamilies = new Set<string>();
		for (const person of people) {
			// Step-fathers
			if (person.stepfatherCrIds && person.stepfatherCrIds.length > 0) {
				for (const stepfatherCrId of person.stepfatherCrIds) {
					const familyKey = `step_${stepfatherCrId}_NONE`;
					if (!processedStepFamilies.has(familyKey)) {
						const family: GedcomFamilyRecord = {
							id: `F${families.length + 1}`,
							childIds: [],
							husbandId: crIdToGedcomId.get(stepfatherCrId),
							pediType: 'step'
						};

						// Find all children with this stepfather
						for (const child of people) {
							if (child.stepfatherCrIds?.includes(stepfatherCrId)) {
								const childGedcomId = crIdToGedcomId.get(child.crId);
								if (childGedcomId) {
									family.childIds.push(childGedcomId);
								}
							}
						}

						if (family.childIds.length > 0) {
							families.push(family);
							processedStepFamilies.add(familyKey);
						}
					}
				}
			}

			// Step-mothers
			if (person.stepmotherCrIds && person.stepmotherCrIds.length > 0) {
				for (const stepmotherCrId of person.stepmotherCrIds) {
					const familyKey = `step_NONE_${stepmotherCrId}`;
					if (!processedStepFamilies.has(familyKey)) {
						const family: GedcomFamilyRecord = {
							id: `F${families.length + 1}`,
							childIds: [],
							wifeId: crIdToGedcomId.get(stepmotherCrId),
							pediType: 'step'
						};

						// Find all children with this stepmother
						for (const child of people) {
							if (child.stepmotherCrIds?.includes(stepmotherCrId)) {
								const childGedcomId = crIdToGedcomId.get(child.crId);
								if (childGedcomId) {
									family.childIds.push(childGedcomId);
								}
							}
						}

						if (family.childIds.length > 0) {
							families.push(family);
							processedStepFamilies.add(familyKey);
						}
					}
				}
			}
		}

		// Build families from adoptive parent relationships
		const processedAdoptiveFamilies = new Set<string>();
		for (const person of people) {
			if (person.adoptiveFatherCrId || person.adoptiveMotherCrId) {
				const familyKey = `adop_${person.adoptiveFatherCrId || 'NONE'}_${person.adoptiveMotherCrId || 'NONE'}`;

				if (!processedAdoptiveFamilies.has(familyKey)) {
					const family: GedcomFamilyRecord = {
						id: `F${families.length + 1}`,
						childIds: [],
						husbandId: person.adoptiveFatherCrId ? crIdToGedcomId.get(person.adoptiveFatherCrId) : undefined,
						wifeId: person.adoptiveMotherCrId ? crIdToGedcomId.get(person.adoptiveMotherCrId) : undefined,
						pediType: 'adop'
					};

					// Find all children with the same adoptive parents
					for (const child of people) {
						if (child.adoptiveFatherCrId === person.adoptiveFatherCrId &&
							child.adoptiveMotherCrId === person.adoptiveMotherCrId) {
							const childGedcomId = crIdToGedcomId.get(child.crId);
							if (childGedcomId) {
								family.childIds.push(childGedcomId);
							}
						}
					}

					if (family.childIds.length > 0) {
						families.push(family);
						processedAdoptiveFamilies.add(familyKey);
					}
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
	 * Resolve sex value using property and value alias services
	 * Returns GEDCOM-format sex value (M, F, or U)
	 */
	private resolveSexValue(person: PersonNode): 'M' | 'F' | 'U' | undefined {
		// Try to resolve sex from frontmatter using property aliases
		let sexValue: string | undefined = person.sex;

		// If property alias service is available, try to resolve from raw frontmatter
		if (this.propertyAliasService) {
			const cache = this.app.metadataCache.getFileCache(person.file);
			if (cache?.frontmatter) {
				const resolved = this.propertyAliasService.resolve(cache.frontmatter, 'sex');
				if (resolved && typeof resolved === 'string') {
					sexValue = resolved;
				}
			}
		}

		// If we have a sex value, resolve it using value alias service
		if (sexValue && this.valueAliasService) {
			const canonicalSex = this.valueAliasService.resolve('sex', sexValue);

			// Map canonical values to GEDCOM format
			const normalized = canonicalSex.toLowerCase();
			if (normalized === 'male' || normalized === 'm') return 'M';
			if (normalized === 'female' || normalized === 'f') return 'F';
			if (normalized === 'nonbinary' || normalized === 'unknown' || normalized === 'u') return 'U';

			// For unrecognized values, try legacy format
			if (sexValue === 'M' || sexValue === 'F' || sexValue === 'U') {
				return sexValue;
			}
		} else if (sexValue) {
			// No value alias service, use value directly if it's in GEDCOM format
			const upper = sexValue.toUpperCase();
			if (upper === 'M' || upper === 'F' || upper === 'U') {
				return upper;
			}
		}

		return undefined;
	}

	/**
	 * Resolve gender_identity value using property and value alias services
	 * Returns resolved gender identity value as string
	 */
	private resolveGenderIdentityValue(person: PersonNode): string | undefined {
		// Try to resolve gender_identity from frontmatter using property aliases
		let genderIdentityValue: string | undefined;

		// If property alias service is available, try to resolve from raw frontmatter
		if (this.propertyAliasService) {
			const cache = this.app.metadataCache.getFileCache(person.file);
			if (cache?.frontmatter) {
				const resolved = this.propertyAliasService.resolve(cache.frontmatter, 'gender_identity');
				if (resolved && typeof resolved === 'string') {
					genderIdentityValue = resolved;
				}
			}
		}

		// If we have a gender_identity value, resolve it using value alias service
		if (genderIdentityValue && this.valueAliasService) {
			return this.valueAliasService.resolve('gender_identity', genderIdentityValue);
		}

		return genderIdentityValue;
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

	/**
	 * Map Canvas Roots event type to GEDCOM tag
	 */
	private eventTypeToGedcomTag(eventType: string): string | null {
		const mapping: Record<string, string> = {
			'birth': 'BIRT',
			'death': 'DEAT',
			'burial': 'BURI',
			'cremation': 'CREM',
			'adoption': 'ADOP',
			'graduation': 'GRAD',
			'retirement': 'RETI',
			'census': 'CENS',
			'residence': 'RESI',
			'occupation': 'OCCU',
			'education': 'EDUC',
			'probate': 'PROB',
			'will': 'WILL',
			'naturalization': 'NATU',
			'military': 'MILI',
			'immigration': 'IMMI',
			'emigration': 'EMIG',
			'baptism': 'BAPM',
			'christening': 'CHR',
			'confirmation': 'CONF',
			'first_communion': 'FCOM',
			'ordination': 'ORDN',
			'bar_mitzvah': 'BARM',
			'bas_mitzvah': 'BASM',
			'blessing': 'BLES',
			'engagement': 'ENGA',
			'annulment': 'ANUL'
		};

		return mapping[eventType] || null;
	}

	/**
	 * Build event records for a person
	 * Returns GEDCOM lines for events linked to this person
	 */
	private buildEventRecords(person: PersonNode, events: EventNote[], sourceIdMap: Map<string, string>): string[] {
		const lines: string[] = [];

		// Filter events that reference this person
		const personEvents = events.filter(event => {
			// Check if person is referenced in event.person field
			if (event.person) {
				const personLink = extractWikilinkPath(event.person);
				if (personLink === person.name || personLink === person.file.basename) {
					return true;
				}
			}

			// Check if person is in event.persons array
			if (event.persons) {
				for (const p of event.persons) {
					const personLink = extractWikilinkPath(p);
					if (personLink === person.name || personLink === person.file.basename) {
						return true;
					}
				}
			}

			return false;
		});

		// Build GEDCOM lines for each event
		for (const event of personEvents) {
			const gedcomTag = this.eventTypeToGedcomTag(event.eventType);

			if (gedcomTag) {
				// Standard GEDCOM event tag
				lines.push(`1 ${gedcomTag}`);

				// Add date if present
				if (event.date) {
					const gedcomDate = this.formatDateForGedcom(event.date);
					if (gedcomDate) {
						lines.push(`2 DATE ${gedcomDate}`);
					}
				}

				// Add place if present
				if (event.place) {
					const placeName = extractWikilinkPath(event.place);
					lines.push(...this.buildPlaceLines(placeName, 2));
				}

				// Add source references if present
				if (event.sources && event.sources.length > 0) {
					for (const sourceLink of event.sources) {
						const sourceCrId = this.extractSourceCrId(sourceLink);
						if (sourceCrId) {
							const sourceId = sourceIdMap.get(sourceCrId);
							if (sourceId) {
								lines.push(`2 SOUR @${sourceId}@`);
							}
						}
					}
				}

				// Add note with event title and description
				if (event.title || event.description) {
					const noteText = event.description || event.title;
					lines.push(`2 NOTE ${noteText}`);
				}
			} else if (event.eventType === 'custom' || event.eventType) {
				// Custom event type - use EVEN tag with TYPE
				lines.push('1 EVEN');

				// Add custom type
				const eventName = event.title || event.eventType;
				lines.push(`2 TYPE ${eventName}`);

				// Add date if present
				if (event.date) {
					const gedcomDate = this.formatDateForGedcom(event.date);
					if (gedcomDate) {
						lines.push(`2 DATE ${gedcomDate}`);
					}
				}

				// Add place if present
				if (event.place) {
					const placeName = extractWikilinkPath(event.place);
					lines.push(...this.buildPlaceLines(placeName, 2));
				}

				// Add source references if present
				if (event.sources && event.sources.length > 0) {
					for (const sourceLink of event.sources) {
						const sourceCrId = this.extractSourceCrId(sourceLink);
						if (sourceCrId) {
							const sourceId = sourceIdMap.get(sourceCrId);
							if (sourceId) {
								lines.push(`2 SOUR @${sourceId}@`);
							}
						}
					}
				}

				// Add note with description
				if (event.description) {
					lines.push(`2 NOTE ${event.description}`);
				}
			}
		}

		return lines;
	}

	/**
	 * Extract cr_id from a source wikilink
	 * Handles formats like [[Source Name]] or [[Source Name|Display]]
	 */
	private extractSourceCrId(wikilink: string): string | null {
		// Extract link path (handles alias format automatically)
		const linkPath = extractWikilinkPath(wikilink);

		// Try to find source by title (file name without extension)
		if (this.sourceService) {
			const sources = this.sourceService.getAllSources();
			const source = sources.find(s => {
				const fileName = s.filePath.split('/').pop()?.replace('.md', '') || '';
				return fileName === linkPath || s.title === linkPath;
			});
			return source?.crId || null;
		}

		return null;
	}
}
