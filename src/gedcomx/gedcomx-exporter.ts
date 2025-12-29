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
import { PropertyAliasService } from '../core/property-alias-service';
import { ValueAliasService } from '../core/value-alias-service';
import { EventService } from '../events/services/event-service';
import type { EventNote } from '../events/types/event-types';
import { SourceService } from '../sources/services/source-service';
import type { SourceNote } from '../sources/types/source-types';
import { PlaceGraphService } from '../core/place-graph';
import type { PlaceNode } from '../models/place';
import type { CanvasRootsSettings } from '../settings';
import { extractWikilinkPath } from '../utils/wikilink-resolver';
import {
	type GedcomXDocument,
	type GedcomXPerson,
	type GedcomXRelationship,
	type GedcomXName,
	type GedcomXFact,
	type GedcomXSourceDescription,
	type GedcomXAgent,
	type GedcomXPlaceDescription,
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
	private eventService: EventService | null = null;
	private sourceService: SourceService | null = null;
	private placeGraphService: PlaceGraphService | null = null;
	private propertyAliasService: PropertyAliasService | null = null;
	private valueAliasService: ValueAliasService | null = null;

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

			// Build GEDCOM X document
			new Notice('Generating GEDCOM X data...');
			const document = this.buildGedcomXDocument(
				filteredPeople,
				allEvents,
				allSources,
				allPlaces,
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
		events: EventNote[],
		sources: SourceNote[],
		places: PlaceNode[],
		options: GedcomXExportOptions,
		privacyService: PrivacyService | null
	): GedcomXDocument {
		// Create ID mapping for relationships
		const crIdToGedcomXId = new Map<string, string>();
		people.forEach((person, index) => {
			crIdToGedcomXId.set(person.crId, `P${index + 1}`);
		});

		// Create ID mapping for sources
		const sourceIdMap = new Map<string, string>();
		sources.forEach((source, index) => {
			sourceIdMap.set(source.crId, `SD${index + 2}`); // Start at SD2 (SD1 is export metadata)
		});

		// Create ID mapping for places
		const placeIdMap = new Map<string, string>();
		places.forEach((place, index) => {
			placeIdMap.set(place.id, `PL${index + 1}`);
		});

		// Build persons
		const persons: GedcomXPerson[] = people.map(person => {
			return this.buildPerson(person, crIdToGedcomXId, events, sourceIdMap, placeIdMap, privacyService);
		});

		// Build relationships
		const relationships = this.buildRelationships(people, crIdToGedcomXId);

		// Build source descriptions - start with export metadata
		const sourceDescriptions: GedcomXSourceDescription[] = [{
			id: 'SD1',
			titles: [{
				value: `Export from ${options.sourceApp || 'Canvas Roots'}`
			}],
			citations: [{
				value: `Exported on ${new Date().toISOString()}`
			}]
		}];

		// Add source records from Canvas Roots
		for (const source of sources) {
			const sourceId = sourceIdMap.get(source.crId);
			if (sourceId) {
				sourceDescriptions.push(this.buildSourceDescription(source, sourceId));
			}
		}

		// Build place descriptions
		const placeDescriptions: GedcomXPlaceDescription[] = [];
		for (const place of places) {
			const placeId = placeIdMap.get(place.id);
			if (placeId) {
				placeDescriptions.push(this.buildPlaceDescription(place, placeId, placeIdMap));
			}
		}

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
			description: '#SD1',
			persons,
			relationships,
			sourceDescriptions,
			agents,
			places: placeDescriptions.length > 0 ? placeDescriptions : undefined
		};
	}

	/**
	 * Build a GEDCOM X source description from a SourceNote
	 */
	private buildSourceDescription(source: SourceNote, sourceId: string): GedcomXSourceDescription {
		const sourceDesc: GedcomXSourceDescription = {
			id: sourceId
		};

		// Add title
		if (source.title) {
			sourceDesc.titles = [{ value: source.title }];
		}

		// Build citation text from available fields
		const citationParts: string[] = [];
		if (source.repository) {
			citationParts.push(source.repository);
		}
		if (source.collection) {
			citationParts.push(source.collection);
		}
		if (source.date) {
			citationParts.push(`(${source.date})`);
		}

		if (citationParts.length > 0) {
			sourceDesc.citations = [{ value: citationParts.join(', ') }];
		}

		// Add repository URL if present
		if (source.repositoryUrl) {
			sourceDesc.about = source.repositoryUrl;
		}

		return sourceDesc;
	}

	/**
	 * Build a GEDCOM X place description from a PlaceNode
	 */
	private buildPlaceDescription(place: PlaceNode, placeId: string, placeIdMap: Map<string, string>): GedcomXPlaceDescription {
		const placeDesc: GedcomXPlaceDescription = {
			id: placeId,
			names: [{ value: place.name }]
		};

		// Add place type as URI if available
		if (place.placeType) {
			// Map common place types to GEDCOM X URIs
			const typeMapping: Record<string, string> = {
				'city': 'http://gedcomx.org/City',
				'town': 'http://gedcomx.org/Town',
				'village': 'http://gedcomx.org/Village',
				'country': 'http://gedcomx.org/Country',
				'state': 'http://gedcomx.org/State',
				'province': 'http://gedcomx.org/Province',
				'county': 'http://gedcomx.org/County',
				'parish': 'http://gedcomx.org/Parish',
				'cemetery': 'http://gedcomx.org/Cemetery',
				'church': 'http://gedcomx.org/Church'
			};
			placeDesc.type = typeMapping[place.placeType.toLowerCase()] || `http://gedcomx.org/${place.placeType}`;
		}

		// Add coordinates if available
		if (place.coordinates) {
			placeDesc.latitude = place.coordinates.lat;
			placeDesc.longitude = place.coordinates.long;
		}

		// Add jurisdiction (parent place) if available
		if (place.parentId) {
			const parentPlaceId = placeIdMap.get(place.parentId);
			if (parentPlaceId) {
				placeDesc.jurisdiction = { resource: `#${parentPlaceId}` };
			}
		}

		return placeDesc;
	}

	/**
	 * Build a GEDCOM X person from a PersonNode
	 */
	private buildPerson(
		person: PersonNode,
		crIdToGedcomXId: Map<string, string>,
		events: EventNote[],
		sourceIdMap: Map<string, string>,
		placeIdMap: Map<string, string>,
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

		// Add event facts linked to this person
		if (events.length > 0) {
			const eventFacts = this.buildEventFacts(person, events, sourceIdMap);
			facts.push(...eventFacts);
		}

		// Add gender_identity as a custom fact (if not protected)
		const genderIdentity = this.resolveGenderIdentityValue(person);
		if (genderIdentity && !privacyResult?.isProtected) {
			facts.push({
				type: 'http://gedcomx.org/Fact',
				value: `Gender Identity: ${genderIdentity}`
			});
		}

		// Build gender (resolve using alias services)
		const sexValue = this.resolveSexValue(person);
		const gender = this.convertGender(sexValue);

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

			// Step-parent relationships (with StepParent lineage type fact)
			if (person.stepfatherCrIds && person.stepfatherCrIds.length > 0) {
				for (const stepfatherId of person.stepfatherCrIds) {
					const stepfatherGedcomXId = crIdToGedcomXId.get(stepfatherId);
					if (stepfatherGedcomXId) {
						const key = `PC:${stepfatherGedcomXId}:${personId}:step`;
						if (!addedRelationships.has(key)) {
							relationships.push({
								id: `R${relationshipCounter++}`,
								type: GEDCOMX_TYPES.PARENT_CHILD,
								person1: { resource: `#${stepfatherGedcomXId}` },
								person2: { resource: `#${personId}` },
								facts: [{ type: GEDCOMX_TYPES.STEP_PARENT }]
							});
							addedRelationships.add(key);
						}
					}
				}
			}

			if (person.stepmotherCrIds && person.stepmotherCrIds.length > 0) {
				for (const stepmotherId of person.stepmotherCrIds) {
					const stepmotherGedcomXId = crIdToGedcomXId.get(stepmotherId);
					if (stepmotherGedcomXId) {
						const key = `PC:${stepmotherGedcomXId}:${personId}:step`;
						if (!addedRelationships.has(key)) {
							relationships.push({
								id: `R${relationshipCounter++}`,
								type: GEDCOMX_TYPES.PARENT_CHILD,
								person1: { resource: `#${stepmotherGedcomXId}` },
								person2: { resource: `#${personId}` },
								facts: [{ type: GEDCOMX_TYPES.STEP_PARENT }]
							});
							addedRelationships.add(key);
						}
					}
				}
			}

			// Adoptive parent relationships (with AdoptiveParent lineage type fact)
			if (person.adoptiveFatherCrId) {
				const adoptiveFatherId = crIdToGedcomXId.get(person.adoptiveFatherCrId);
				if (adoptiveFatherId) {
					const key = `PC:${adoptiveFatherId}:${personId}:adop`;
					if (!addedRelationships.has(key)) {
						relationships.push({
							id: `R${relationshipCounter++}`,
							type: GEDCOMX_TYPES.PARENT_CHILD,
							person1: { resource: `#${adoptiveFatherId}` },
							person2: { resource: `#${personId}` },
							facts: [{ type: GEDCOMX_TYPES.ADOPTIVE_PARENT }]
						});
						addedRelationships.add(key);
					}
				}
			}

			if (person.adoptiveMotherCrId) {
				const adoptiveMotherId = crIdToGedcomXId.get(person.adoptiveMotherCrId);
				if (adoptiveMotherId) {
					const key = `PC:${adoptiveMotherId}:${personId}:adop`;
					if (!addedRelationships.has(key)) {
						relationships.push({
							id: `R${relationshipCounter++}`,
							type: GEDCOMX_TYPES.PARENT_CHILD,
							person1: { resource: `#${adoptiveMotherId}` },
							person2: { resource: `#${personId}` },
							facts: [{ type: GEDCOMX_TYPES.ADOPTIVE_PARENT }]
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
	 * Resolve sex value using property and value alias services
	 * Returns canonical sex value
	 */
	private resolveSexValue(person: PersonNode): string | undefined {
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
			return this.valueAliasService.resolve('sex', sexValue);
		}

		return sexValue;
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
	 * Convert internal sex format to GEDCOM X gender type
	 */
	private convertGender(sex?: string): string | null {
		if (!sex) return null;

		const normalized = sex.toLowerCase();
		if (normalized === 'm' || normalized === 'male') {
			return GEDCOMX_TYPES.MALE;
		}
		if (normalized === 'f' || normalized === 'female') {
			return GEDCOMX_TYPES.FEMALE;
		}
		if (normalized === 'nonbinary') {
			return GEDCOMX_TYPES.UNKNOWN; // GEDCOM X doesn't have nonbinary, use unknown
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

	/**
	 * Map Canvas Roots event type to GEDCOM X fact type URI
	 */
	private eventTypeToGedcomXType(eventType: string): string | null {
		const mapping: Record<string, string> = {
			'birth': GEDCOMX_TYPES.BIRTH,
			'death': GEDCOMX_TYPES.DEATH,
			'marriage': GEDCOMX_TYPES.MARRIAGE,
			'divorce': 'http://gedcomx.org/Divorce',
			'burial': GEDCOMX_TYPES.BURIAL,
			'cremation': 'http://gedcomx.org/Cremation',
			'adoption': 'http://gedcomx.org/Adoption',
			'baptism': GEDCOMX_TYPES.BAPTISM,
			'christening': GEDCOMX_TYPES.CHRISTENING,
			'confirmation': 'http://gedcomx.org/Confirmation',
			'ordination': 'http://gedcomx.org/Ordination',
			'graduation': 'http://gedcomx.org/Graduation',
			'retirement': 'http://gedcomx.org/Retirement',
			'residence': GEDCOMX_TYPES.RESIDENCE,
			'occupation': GEDCOMX_TYPES.OCCUPATION,
			'education': 'http://gedcomx.org/Education',
			'military': 'http://gedcomx.org/MilitaryService',
			'immigration': 'http://gedcomx.org/Immigration',
			'emigration': 'http://gedcomx.org/Emigration',
			'naturalization': 'http://gedcomx.org/Naturalization',
			'census': 'http://gedcomx.org/Census',
			'probate': 'http://gedcomx.org/Probate',
			'will': 'http://gedcomx.org/Will',
			'engagement': 'http://gedcomx.org/Engagement',
			'annulment': 'http://gedcomx.org/Annulment'
		};

		return mapping[eventType] || null;
	}

	/**
	 * Build event facts for a person
	 * Returns GEDCOM X facts array for events linked to this person
	 */
	private buildEventFacts(person: PersonNode, events: EventNote[], sourceIdMap: Map<string, string>): GedcomXFact[] {
		const facts: GedcomXFact[] = [];

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

		// Build GEDCOM X facts for each event
		for (const event of personEvents) {
			const gedcomXType = this.eventTypeToGedcomXType(event.eventType);

			if (gedcomXType) {
				// Standard GEDCOM X event type
				const fact: GedcomXFact = {
					type: gedcomXType
				};

				// Add date if present
				if (event.date) {
					fact.date = {
						original: event.date,
						formal: this.formatFormalDate(event.date)
					};
				}

				// Add place if present
				if (event.place) {
					const placeName = extractWikilinkPath(event.place);
					fact.place = {
						original: placeName
					};
				}

				// Add description as value if present
				if (event.description || event.title) {
					fact.value = event.description || event.title;
				}

				// Add source references if present
				if (event.sources && event.sources.length > 0) {
					fact.sources = [];
					for (const sourceLink of event.sources) {
						const sourceCrId = this.extractSourceCrId(sourceLink);
						if (sourceCrId) {
							const sourceId = sourceIdMap.get(sourceCrId);
							if (sourceId) {
								fact.sources.push({ description: `#${sourceId}` });
							}
						}
					}
				}

				facts.push(fact);
			} else if (event.eventType === 'custom' || event.eventType) {
				// Custom event type - use generic fact type
				const fact: GedcomXFact = {
					type: 'http://gedcomx.org/Fact',
					value: event.title || event.eventType
				};

				// Add date if present
				if (event.date) {
					fact.date = {
						original: event.date,
						formal: this.formatFormalDate(event.date)
					};
				}

				// Add place if present
				if (event.place) {
					const placeName = extractWikilinkPath(event.place);
					fact.place = {
						original: placeName
					};
				}

				// Add description if present
				if (event.description) {
					if (fact.value) {
						fact.value = `${fact.value}: ${event.description}`;
					} else {
						fact.value = event.description;
					}
				}

				// Add source references if present
				if (event.sources && event.sources.length > 0) {
					fact.sources = [];
					for (const sourceLink of event.sources) {
						const sourceCrId = this.extractSourceCrId(sourceLink);
						if (sourceCrId) {
							const sourceId = sourceIdMap.get(sourceCrId);
							if (sourceId) {
								fact.sources.push({ description: `#${sourceId}` });
							}
						}
					}
				}

				facts.push(fact);
			}
		}

		return facts;
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
