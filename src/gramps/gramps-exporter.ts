/**
 * Gramps XML Exporter for Canvas Roots
 *
 * Exports person notes from Obsidian vault to Gramps XML format.
 * Based on the Gramps XML DTD: https://github.com/gramps-project/gramps/blob/master/data/grampsxml.dtd
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

const logger = getLogger('GrampsExporter');

/**
 * Gramps XML export options
 */
export interface GrampsExportOptions {
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

	/** Export filename (without .gramps extension) */
	fileName?: string;

	/** Source application identifier */
	sourceApp?: string;

	/** Source version */
	sourceVersion?: string;

	/** Privacy settings for protecting living persons */
	privacySettings?: PrivacySettings;
}

/**
 * Gramps XML export result
 */
export interface GrampsExportResult {
	success: boolean;
	personsExported: number;
	familiesExported: number;
	eventsExported: number;
	errors: string[];
	xmlContent?: string;
	fileName: string;
	/** Number of living persons excluded due to privacy settings */
	privacyExcluded?: number;
	/** Number of living persons with obfuscated data */
	privacyObfuscated?: number;
}

/**
 * Internal tracking for Gramps export
 */
interface GrampsExportContext {
	personHandles: Map<string, string>; // cr_id -> handle
	eventHandles: Map<string, string>;  // event key -> handle
	familyHandles: Map<string, string>; // family key -> handle
	placeHandles: Map<string, string>;  // place name -> handle
	/** Additional places created from event references (not in PlaceGraphService) */
	additionalPlaces: Map<string, string>; // place name -> handle
	handleCounter: number;
}

/**
 * Family data extracted for building person back-references
 */
/**
 * Child reference with optional relationship type
 */
interface ChildRef {
	handle: string;
	/** Mother relationship: 'Birth' (default), 'Stepchild', 'Adopted' */
	mrel?: 'Birth' | 'Stepchild' | 'Adopted';
	/** Father relationship: 'Birth' (default), 'Stepchild', 'Adopted' */
	frel?: 'Birth' | 'Stepchild' | 'Adopted';
}

interface FamilyData {
	handle: string;
	key: string;
	father?: string;  // person handle
	mother?: string;  // person handle
	children: string[]; // person handles (for backward compatibility)
	childRefs?: ChildRef[]; // child references with relationship types
}

/**
 * Export person notes to Gramps XML format
 */
export class GrampsExporter {
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
	 * Export people to Gramps XML format
	 */
	exportToGramps(options: GrampsExportOptions): GrampsExportResult {
		const result: GrampsExportResult = {
			success: false,
			personsExported: 0,
			familiesExported: 0,
			eventsExported: 0,
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

			// Build Gramps XML document
			new Notice('Generating Gramps XML data...');
			const xmlContent = this.buildGrampsXml(
				filteredPeople,
				allEvents,
				allSources,
				allPlaces,
				options,
				privacyService
			);

			result.xmlContent = xmlContent.xml;
			result.personsExported = filteredPeople.length;
			result.familiesExported = xmlContent.familyCount;
			result.eventsExported = xmlContent.eventCount;
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
	 * Build complete Gramps XML content
	 */
	private buildGrampsXml(
		people: PersonNode[],
		events: EventNote[],
		sources: SourceNote[],
		places: PlaceNode[],
		options: GrampsExportOptions,
		privacyService: PrivacyService | null
	): { xml: string; familyCount: number; eventCount: number } {
		const context: GrampsExportContext = {
			personHandles: new Map(),
			eventHandles: new Map(),
			familyHandles: new Map(),
			placeHandles: new Map(),
			additionalPlaces: new Map(),
			handleCounter: 1
		};

		// Add source handles to context
		const sourceHandles = new Map<string, string>();
		sources.forEach(source => {
			const handle = `_s${this.generateHandle(context)}`;
			sourceHandles.set(source.crId, handle);
		});

		// Generate handles for all people first
		people.forEach(person => {
			const handle = `_${this.generateHandle(context)}`;
			context.personHandles.set(person.crId, handle);
		});

		// Pre-populate placeHandles from PlaceGraphService places
		// This allows events to reference existing places by name
		const placeHandleMap = new Map<string, string>();
		for (const place of places) {
			const handle = `_p${this.generateHandle(context)}`;
			placeHandleMap.set(place.id, handle);
			// Also map by name for event lookups
			context.placeHandles.set(place.name, handle);
		}

		// Build families FIRST to populate familyHandles (needed for person back-references)
		const familyData = this.extractFamilyData(people, context);

		// Build XML sections
		const sourcesXml = this.buildSources(sources, sourceHandles, context);
		const eventsXml = this.buildEvents(people, events, context, sourceHandles, privacyService);
		const placesXml = this.buildPlaces(places, context, placeHandleMap);
		const persons = this.buildPersons(people, events, context, privacyService, familyData);
		const families = this.buildFamiliesXml(familyData, context);

		// Get current date
		const now = new Date();
		const dateStr = now.toISOString().split('T')[0];

		// Build complete XML
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE database PUBLIC "-//Gramps//DTD Gramps XML 1.7.1//EN"
"http://gramps-project.org/xml/1.7.1/grampsxml.dtd">
<database xmlns="http://gramps-project.org/xml/1.7.1/">
  <header>
    <created date="${dateStr}" version="${options.sourceVersion || '1.0.0'}"/>
    <researcher>
      <resname>${this.escapeXml(options.sourceApp || 'Canvas Roots')}</resname>
    </researcher>
  </header>
${sourcesXml.xml}
${eventsXml.xml}
${placesXml.xml}
${persons.xml}
${families.xml}
</database>
`;

		return {
			xml,
			familyCount: families.count,
			eventCount: eventsXml.count
		};
	}

	/**
	 * Build sources section
	 */
	private buildSources(
		sources: SourceNote[],
		sourceHandles: Map<string, string>,
		context: GrampsExportContext
	): { xml: string } {
		if (sources.length === 0) {
			return { xml: '  <sources/>' };
		}

		const sourceLines: string[] = [];
		let sourceCounter = 1;

		for (const source of sources) {
			const handle = sourceHandles.get(source.crId);
			if (!handle) continue;

			sourceLines.push(`    <source handle="${handle}" id="S${sourceCounter++}">`);

			// Title
			if (source.title) {
				sourceLines.push(`      <stitle>${this.escapeXml(source.title)}</stitle>`);
			}

			// Repository (author in Gramps terminology)
			if (source.repository) {
				sourceLines.push(`      <sauthor>${this.escapeXml(source.repository)}</sauthor>`);
			}

			// Collection (publication info in Gramps)
			if (source.collection) {
				sourceLines.push(`      <spubinfo>${this.escapeXml(source.collection)}</spubinfo>`);
			}

			// Add note with additional information
			if (source.date || source.repositoryUrl) {
				const noteHandle = `_n${this.generateHandle(context)}`;
				sourceLines.push(`      <noteref hlink="${noteHandle}"/>`);
			}

			sourceLines.push('    </source>');
		}

		return {
			xml: '  <sources>\n' + sourceLines.join('\n') + '\n  </sources>'
		};
	}

	/**
	 * Build events section
	 */
	private buildEvents(
		people: PersonNode[],
		events: EventNote[],
		context: GrampsExportContext,
		sourceHandles: Map<string, string>,
		privacyService: PrivacyService | null
	): { xml: string; count: number } {
		const eventLines: string[] = [];
		let eventCounter = 1;

		for (const person of people) {
			const personHandle = context.personHandles.get(person.crId);
			if (!personHandle) continue;

			// Check privacy status
			const privacyResult = privacyService?.applyPrivacy({
				name: person.name,
				birthDate: person.birthDate,
				deathDate: person.deathDate
			});

			const showBirthDetails = !privacyResult?.isProtected || privacyResult.showBirthDate;

			// Birth event
			if (showBirthDetails && (person.birthDate || person.birthPlace)) {
				const eventHandle = `_e${this.generateHandle(context)}`;
				const eventKey = `birth:${person.crId}`;
				context.eventHandles.set(eventKey, eventHandle);

				eventLines.push(`    <event handle="${eventHandle}" id="E${eventCounter++}">`);
				eventLines.push('      <type>Birth</type>');
				if (person.birthDate) {
					eventLines.push(`      <dateval val="${this.escapeXml(this.formatDateForGramps(person.birthDate))}"/>`);
				}
				if (person.birthPlace) {
					const placeHandle = this.getOrCreatePlace(person.birthPlace, context);
					eventLines.push(`      <place hlink="${placeHandle}"/>`);
				}
				eventLines.push('    </event>');
			}

			// Death event
			if (person.deathDate || person.deathPlace) {
				const eventHandle = `_e${this.generateHandle(context)}`;
				const eventKey = `death:${person.crId}`;
				context.eventHandles.set(eventKey, eventHandle);

				eventLines.push(`    <event handle="${eventHandle}" id="E${eventCounter++}">`);
				eventLines.push('      <type>Death</type>');
				if (person.deathDate) {
					eventLines.push(`      <dateval val="${this.escapeXml(this.formatDateForGramps(person.deathDate))}"/>`);
				}
				if (person.deathPlace) {
					const placeHandle = this.getOrCreatePlace(person.deathPlace, context);
					eventLines.push(`      <place hlink="${placeHandle}"/>`);
				}
				eventLines.push('    </event>');
			}

			// Burial event
			if (person.burialPlace) {
				const eventHandle = `_e${this.generateHandle(context)}`;
				const eventKey = `burial:${person.crId}`;
				context.eventHandles.set(eventKey, eventHandle);

				eventLines.push(`    <event handle="${eventHandle}" id="E${eventCounter++}">`);
				eventLines.push('      <type>Burial</type>');
				const placeHandle = this.getOrCreatePlace(person.burialPlace, context);
				eventLines.push(`      <place hlink="${placeHandle}"/>`);
				eventLines.push('    </event>');
			}

			// Occupation event
			if (person.occupation) {
				const eventHandle = `_e${this.generateHandle(context)}`;
				const eventKey = `occupation:${person.crId}`;
				context.eventHandles.set(eventKey, eventHandle);

				eventLines.push(`    <event handle="${eventHandle}" id="E${eventCounter++}">`);
				eventLines.push('      <type>Occupation</type>');
				eventLines.push(`      <description>${this.escapeXml(person.occupation)}</description>`);
				eventLines.push('    </event>');
			}
		}

		// Add events from EventNote records
		for (const event of events) {
			const eventHandle = `_e${this.generateHandle(context)}`;
			const eventKey = `event:${event.crId}`;
			context.eventHandles.set(eventKey, eventHandle);

			eventLines.push(`    <event handle="${eventHandle}" id="E${eventCounter++}">`);

			// Map event type to Gramps event type
			const grampsType = this.eventTypeToGrampsType(event.eventType);
			eventLines.push(`      <type>${this.escapeXml(grampsType)}</type>`);

			// Add date if present
			if (event.date) {
				eventLines.push(`      <dateval val="${this.escapeXml(this.formatDateForGramps(event.date))}"/>`);
			}

			// Add place if present
			if (event.place) {
				const placeName = extractWikilinkPath(event.place);
				const placeHandle = this.getOrCreatePlace(placeName, context);
				eventLines.push(`      <place hlink="${placeHandle}"/>`);
			}

			// Add description if present
			if (event.description || event.title) {
				const description = event.description || event.title;
				eventLines.push(`      <description>${this.escapeXml(description)}</description>`);
			}

			// Add source references if present
			if (event.sources && event.sources.length > 0) {
				for (const sourceLink of event.sources) {
					const sourceCrId = this.extractSourceCrId(sourceLink);
					if (sourceCrId) {
						const sourceHandle = sourceHandles.get(sourceCrId);
						if (sourceHandle) {
							eventLines.push(`      <sourceref hlink="${sourceHandle}"/>`);
						}
					}
				}
			}

			eventLines.push('    </event>');
		}

		if (eventLines.length === 0) {
			return { xml: '  <events/>', count: 0 };
		}

		return {
			xml: '  <events>\n' + eventLines.join('\n') + '\n  </events>',
			count: eventCounter - 1
		};
	}

	/**
	 * Build places section from PlaceNode data
	 */
	private buildPlaces(
		places: PlaceNode[],
		context: GrampsExportContext,
		placeHandleMap: Map<string, string>
	): { xml: string; count: number } {
		const placeLines: string[] = [];
		let placeCounter = 1;

		for (const place of places) {
			const handle = placeHandleMap.get(place.id);
			if (!handle) continue;

			// Get place type for Gramps (map to Gramps types, or infer if not set)
			let placeType = this.mapPlaceTypeToGramps(place.placeType);
			if (!placeType) {
				placeType = this.inferPlaceType(place, places);
			}

			placeLines.push(`    <placeobj handle="${handle}" id="P${placeCounter++}"${placeType ? ` type="${this.escapeXml(placeType)}"` : ''}>`);

			// Build hierarchical title by traversing parents
			const hierarchicalName = this.buildHierarchicalPlaceName(place, places);
			placeLines.push(`      <ptitle>${this.escapeXml(hierarchicalName)}</ptitle>`);

			// Place name
			placeLines.push(`      <pname value="${this.escapeXml(place.name)}"/>`);

			// Coordinates (if present)
			if (place.coordinates) {
				placeLines.push(`      <coord lat="${place.coordinates.lat}" long="${place.coordinates.long}"/>`);
			}

			// Parent reference (if present)
			if (place.parentId) {
				const parentHandle = placeHandleMap.get(place.parentId);
				if (parentHandle) {
					placeLines.push(`      <placeref hlink="${parentHandle}"/>`);
				}
			}

			placeLines.push('    </placeobj>');
		}

		// Also output additional places created from event references
		// These are places referenced in events but not in PlaceGraphService
		for (const [placeName, handle] of context.additionalPlaces) {
			// Infer type from name
			const placeType = this.inferPlaceTypeFromName(placeName) || 'Locality';
			const grampsType = placeType.charAt(0).toUpperCase() + placeType.slice(1);

			placeLines.push(`    <placeobj handle="${handle}" id="P${placeCounter++}" type="${this.escapeXml(grampsType)}">`);
			placeLines.push(`      <ptitle>${this.escapeXml(placeName)}</ptitle>`);
			placeLines.push(`      <pname value="${this.escapeXml(placeName)}"/>`);
			placeLines.push('    </placeobj>');
		}

		const totalCount = places.length + context.additionalPlaces.size;

		if (placeLines.length === 0) {
			return { xml: '  <places/>', count: 0 };
		}

		return {
			xml: '  <places>\n' + placeLines.join('\n') + '\n  </places>',
			count: totalCount
		};
	}

	/**
	 * Build hierarchical place name by traversing parent chain
	 */
	private buildHierarchicalPlaceName(place: PlaceNode, allPlaces: PlaceNode[]): string {
		const parts: string[] = [place.name];
		const visited = new Set<string>();
		let currentId = place.parentId;

		while (currentId) {
			if (visited.has(currentId)) {
				// Circular reference detected
				break;
			}
			visited.add(currentId);

			const parent = allPlaces.find(p => p.id === currentId);
			if (parent) {
				parts.push(parent.name);
				currentId = parent.parentId;
			} else {
				break;
			}
		}

		return parts.join(', ');
	}

	/**
	 * Map Canvas Roots place type to Gramps place type
	 */
	private mapPlaceTypeToGramps(placeType?: string): string {
		if (!placeType) return '';

		const mapping: Record<string, string> = {
			'planet': 'Unknown',
			'continent': 'Unknown',
			'country': 'Country',
			'state': 'State',
			'province': 'Province',
			'region': 'Region',
			'county': 'County',
			'city': 'City',
			'town': 'Town',
			'village': 'Village',
			'district': 'District',
			'parish': 'Parish',
			'castle': 'Building',
			'estate': 'Farm',
			'cemetery': 'Cemetery',
			'church': 'Church'
		};

		return mapping[placeType.toLowerCase()] || placeType.charAt(0).toUpperCase() + placeType.slice(1);
	}

	/**
	 * Infer place type from name patterns and hierarchy when not explicitly set
	 */
	private inferPlaceType(place: PlaceNode, allPlaces: PlaceNode[]): string {
		const name = place.name.toLowerCase();

		// Check for administrative division suffixes in the name
		if (name.includes(' county') || name.endsWith(' co') || name.endsWith(' co.')) {
			return 'County';
		}
		if (name.includes(' parish')) {
			return 'Parish';
		}
		if (name.includes(' township') || name.includes(' twp')) {
			return 'Township';
		}
		if (name.includes(' district')) {
			return 'District';
		}
		if (name.includes(' borough')) {
			return 'Borough';
		}
		if (name.includes(' province')) {
			return 'Province';
		}
		if (name.includes(' region')) {
			return 'Region';
		}

		// Check for specific place types in name
		if (name.includes(' cemetery') || name.includes(' graveyard')) {
			return 'Cemetery';
		}
		if (name.includes(' church') || name.includes(' cathedral') || name.includes(' chapel')) {
			return 'Church';
		}
		if (name.includes(' hospital')) {
			return 'Building';
		}
		if (name.includes(' farm') || name.includes(' plantation') || name.includes(' ranch')) {
			return 'Farm';
		}

		// Check for country names (common ones)
		const countryNames = [
			'united states', 'usa', 'us', 'united kingdom', 'uk', 'great britain',
			'canada', 'australia', 'germany', 'france', 'ireland', 'scotland',
			'england', 'wales', 'italy', 'spain', 'mexico', 'brazil', 'india',
			'china', 'japan', 'russia', 'poland', 'netherlands', 'belgium',
			'sweden', 'norway', 'denmark', 'finland', 'switzerland', 'austria'
		];
		if (countryNames.includes(name) || countryNames.some(c => name === c)) {
			return 'Country';
		}

		// Check for US state names (without needing parent info)
		const usStates = [
			'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado',
			'connecticut', 'delaware', 'florida', 'georgia', 'hawaii', 'idaho',
			'illinois', 'indiana', 'iowa', 'kansas', 'kentucky', 'louisiana',
			'maine', 'maryland', 'massachusetts', 'michigan', 'minnesota',
			'mississippi', 'missouri', 'montana', 'nebraska', 'nevada',
			'new hampshire', 'new jersey', 'new mexico', 'new york', 'north carolina',
			'north dakota', 'ohio', 'oklahoma', 'oregon', 'pennsylvania',
			'rhode island', 'south carolina', 'south dakota', 'tennessee', 'texas',
			'utah', 'vermont', 'virginia', 'washington', 'west virginia',
			'wisconsin', 'wyoming', 'district of columbia'
		];
		if (usStates.includes(name)) {
			return 'State';
		}

		// Check parent type to infer child type
		if (place.parentId) {
			const parent = allPlaces.find(p => p.id === place.parentId);
			if (parent) {
				// Get parent type - either explicit or inferred
				const parentType = parent.placeType?.toLowerCase() ||
					this.inferPlaceTypeFromName(parent.name);

				// If parent is a country, child is likely a state/province
				if (parentType === 'country') {
					return 'State';
				}
				// If parent is a state, child is likely a county
				if (parentType === 'state' || parentType === 'province') {
					return 'County';
				}
				// If parent is a county, child is likely a city/town
				if (parentType === 'county' || parentType === 'parish') {
					return 'City';
				}
				// If parent is a city, child is likely a neighborhood or address
				if (parentType === 'city' || parentType === 'town' || parentType === 'locality') {
					return 'Neighborhood';
				}
			}
		}

		// Check if this place has children (use childIds if available, or search)
		const hasChildren = (place.childIds && place.childIds.length > 0) ||
			allPlaces.some(p => p.parentId === place.id);
		if (hasChildren) {
			// Count hierarchy depth to guess type
			let depth = 0;
			let currentId = place.parentId;
			while (currentId) {
				depth++;
				const parent = allPlaces.find(p => p.id === currentId);
				currentId = parent?.parentId;
			}

			// Root level with children = likely Country
			if (depth === 0) return 'Country';
			// One level deep with children = likely State
			if (depth === 1) return 'State';
			// Two levels deep with children = likely County
			if (depth === 2) return 'County';
			// Three levels deep with children = likely City
			if (depth === 3) return 'City';
		}

		// Default to Locality for places without clear type indicators
		// This is better than "Unknown" - it's a valid Gramps type for general places
		return 'Locality';
	}

	/**
	 * Quick name-based type inference (used when checking parent types recursively)
	 */
	private inferPlaceTypeFromName(name: string): string | undefined {
		const lowerName = name.toLowerCase();

		// Countries
		const countryNames = [
			'united states', 'usa', 'us', 'united kingdom', 'uk', 'great britain',
			'canada', 'australia', 'germany', 'france', 'ireland', 'scotland',
			'england', 'wales', 'italy', 'spain', 'mexico'
		];
		if (countryNames.includes(lowerName)) return 'country';

		// US States
		const usStates = [
			'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado',
			'connecticut', 'delaware', 'florida', 'georgia', 'hawaii', 'idaho',
			'illinois', 'indiana', 'iowa', 'kansas', 'kentucky', 'louisiana',
			'maine', 'maryland', 'massachusetts', 'michigan', 'minnesota',
			'mississippi', 'missouri', 'montana', 'nebraska', 'nevada',
			'new hampshire', 'new jersey', 'new mexico', 'new york', 'north carolina',
			'north dakota', 'ohio', 'oklahoma', 'oregon', 'pennsylvania',
			'rhode island', 'south carolina', 'south dakota', 'tennessee', 'texas',
			'utah', 'vermont', 'virginia', 'washington', 'west virginia',
			'wisconsin', 'wyoming'
		];
		if (usStates.includes(lowerName)) return 'state';

		// Administrative suffixes
		if (lowerName.includes(' county') || lowerName.endsWith(' co')) return 'county';
		if (lowerName.includes(' parish')) return 'parish';

		return undefined;
	}

	/**
	 * Build persons section
	 */
	private buildPersons(
		people: PersonNode[],
		events: EventNote[],
		context: GrampsExportContext,
		privacyService: PrivacyService | null,
		familyData: FamilyData[]
	): { xml: string } {
		const personLines: string[] = [];
		let personCounter = 1;

		for (const person of people) {
			const handle = context.personHandles.get(person.crId);
			if (!handle) continue;

			// Check privacy status
			const privacyResult = privacyService?.applyPrivacy({
				name: person.name,
				birthDate: person.birthDate,
				deathDate: person.deathDate
			});

			const displayName = privacyResult?.isProtected
				? privacyResult.displayName
				: (person.name || 'Unknown');

			personLines.push(`    <person handle="${handle}" id="I${personCounter++}">`);

			// Gender (resolve using alias services)
			const sexValue = this.resolveSexValue(person);
			const gender = this.convertGender(sexValue);
			personLines.push(`      <gender>${gender}</gender>`);

			// Name
			personLines.push('      <name type="Birth Name">');
			const nameParts = this.parseNameParts(displayName, privacyResult?.isProtected || false);
			if (nameParts.first) {
				personLines.push(`        <first>${this.escapeXml(nameParts.first)}</first>`);
			}
			if (nameParts.surname) {
				personLines.push(`        <surname>${this.escapeXml(nameParts.surname)}</surname>`);
			}
			personLines.push('      </name>');

			// Event references
			const showBirthDetails = !privacyResult?.isProtected || privacyResult.showBirthDate;
			if (showBirthDetails && (person.birthDate || person.birthPlace)) {
				const eventHandle = context.eventHandles.get(`birth:${person.crId}`);
				if (eventHandle) {
					personLines.push(`      <eventref hlink="${eventHandle}" role="Primary"/>`);
				}
			}
			if (person.deathDate || person.deathPlace) {
				const eventHandle = context.eventHandles.get(`death:${person.crId}`);
				if (eventHandle) {
					personLines.push(`      <eventref hlink="${eventHandle}" role="Primary"/>`);
				}
			}
			if (person.burialPlace) {
				const eventHandle = context.eventHandles.get(`burial:${person.crId}`);
				if (eventHandle) {
					personLines.push(`      <eventref hlink="${eventHandle}" role="Primary"/>`);
				}
			}
			if (person.occupation) {
				const eventHandle = context.eventHandles.get(`occupation:${person.crId}`);
				if (eventHandle) {
					personLines.push(`      <eventref hlink="${eventHandle}" role="Primary"/>`);
				}
			}

			// Add event references from EventNote records linked to this person
			for (const event of events) {
				// Check if this event is linked to this person
				let isLinked = false;

				// Check if person is referenced in event.person field
				if (event.person) {
					const personLink = extractWikilinkPath(event.person);
					if (personLink === person.name || personLink === person.file.basename) {
						isLinked = true;
					}
				}

				// Check if person is in event.persons array
				if (!isLinked && event.persons) {
					for (const p of event.persons) {
						const personLink = extractWikilinkPath(p);
						if (personLink === person.name || personLink === person.file.basename) {
							isLinked = true;
							break;
						}
					}
				}

				// If linked, add event reference
				if (isLinked) {
					const eventHandle = context.eventHandles.get(`event:${event.crId}`);
					if (eventHandle) {
						personLines.push(`      <eventref hlink="${eventHandle}" role="Primary"/>`);
					}
				}
			}

			// Add gender_identity as attribute (if not protected)
			const genderIdentity = this.resolveGenderIdentityValue(person);
			if (genderIdentity && !privacyResult?.isProtected) {
				personLines.push('      <attribute type="Gender Identity" value="' + this.escapeXml(genderIdentity) + '"/>');
			}

			// Add research_level as attribute (0-6 based on Hoitink's Six Levels)
			if (person.researchLevel !== undefined) {
				personLines.push('      <attribute type="Research Level" value="' + person.researchLevel + '"/>');
			}

			// Add family back-references (childof and parentin)
			// childof: families where this person is a child
			// parentin: families where this person is a parent (father or mother)
			for (const family of familyData) {
				// Check if this person is a child in this family
				if (family.children.includes(handle)) {
					personLines.push(`      <childof hlink="${family.handle}"/>`);
				}
				// Check if this person is a parent in this family
				if (family.father === handle || family.mother === handle) {
					personLines.push(`      <parentin hlink="${family.handle}"/>`);
				}
			}

			personLines.push('    </person>');
		}

		if (personLines.length === 0) {
			return { xml: '  <people/>' };
		}

		return {
			xml: '  <people>\n' + personLines.join('\n') + '\n  </people>'
		};
	}

	/**
	 * Build families section
	 */
	private buildFamilies(
		people: PersonNode[],
		context: GrampsExportContext
	): { xml: string; count: number } {
		const families = new Map<string, {
			father?: string;
			mother?: string;
			children: string[];
		}>();

		// Build families from parent-child relationships
		for (const person of people) {
			const fatherHandle = person.fatherCrId ? context.personHandles.get(person.fatherCrId) : undefined;
			const motherHandle = person.motherCrId ? context.personHandles.get(person.motherCrId) : undefined;
			const childHandle = context.personHandles.get(person.crId);

			if (!childHandle) continue;
			if (!fatherHandle && !motherHandle) continue;

			// Create family key from parents
			const familyKey = `${fatherHandle || 'none'}:${motherHandle || 'none'}`;

			if (!families.has(familyKey)) {
				families.set(familyKey, {
					father: fatherHandle,
					mother: motherHandle,
					children: []
				});
			}

			families.get(familyKey)!.children.push(childHandle);
		}

		// Also create couple-only families for spouses without children
		for (const person of people) {
			const personHandle = context.personHandles.get(person.crId);
			if (!personHandle) continue;

			if (person.spouseCrIds && person.spouseCrIds.length > 0) {
				for (const spouseId of person.spouseCrIds) {
					const spouseHandle = context.personHandles.get(spouseId);
					if (!spouseHandle) continue;

					// Sort handles to create consistent key
					const [h1, h2] = [personHandle, spouseHandle].sort();
					const familyKey = `${h1}:${h2}`;

					if (!families.has(familyKey)) {
						// Determine who is father/mother based on sex
						const personData = people.find(p => p.crId === person.crId);
						const spouseData = people.find(p => p.crId === spouseId);

						let father: string | undefined;
						let mother: string | undefined;

						if (personData?.sex === 'M') {
							father = personHandle;
							mother = spouseHandle;
						} else if (personData?.sex === 'F') {
							father = spouseHandle;
							mother = personHandle;
						} else if (spouseData?.sex === 'M') {
							father = spouseHandle;
							mother = personHandle;
						} else if (spouseData?.sex === 'F') {
							father = personHandle;
							mother = spouseHandle;
						} else {
							// Unknown sex, just assign arbitrarily
							father = h1;
							mother = h2;
						}

						families.set(familyKey, {
							father,
							mother,
							children: []
						});
					}
				}
			}
		}

		if (families.size === 0) {
			return { xml: '  <families/>', count: 0 };
		}

		const familyLines: string[] = [];
		let familyCounter = 1;

		families.forEach((family, key) => {
			const familyHandle = `_f${this.generateHandle(context)}`;
			context.familyHandles.set(key, familyHandle);

			familyLines.push(`    <family handle="${familyHandle}" id="F${familyCounter++}">`);
			familyLines.push('      <rel type="Married"/>');
			if (family.father) {
				familyLines.push(`      <father hlink="${family.father}"/>`);
			}
			if (family.mother) {
				familyLines.push(`      <mother hlink="${family.mother}"/>`);
			}
			for (const childHandle of family.children) {
				familyLines.push(`      <childref hlink="${childHandle}"/>`);
			}
			familyLines.push('    </family>');
		});

		return {
			xml: '  <families>\n' + familyLines.join('\n') + '\n  </families>',
			count: familyCounter - 1
		};
	}

	/**
	 * Extract family data for building person back-references
	 * This must be called BEFORE buildPersons() so we know which families each person belongs to
	 */
	private extractFamilyData(
		people: PersonNode[],
		context: GrampsExportContext
	): FamilyData[] {
		const familiesMap = new Map<string, {
			father?: string;
			mother?: string;
			children: string[];
		}>();

		// Build families from parent-child relationships
		for (const person of people) {
			const fatherHandle = person.fatherCrId ? context.personHandles.get(person.fatherCrId) : undefined;
			const motherHandle = person.motherCrId ? context.personHandles.get(person.motherCrId) : undefined;
			const childHandle = context.personHandles.get(person.crId);

			if (!childHandle) continue;
			if (!fatherHandle && !motherHandle) continue;

			// Create family key from parents
			const familyKey = `${fatherHandle || 'none'}:${motherHandle || 'none'}`;

			if (!familiesMap.has(familyKey)) {
				familiesMap.set(familyKey, {
					father: fatherHandle,
					mother: motherHandle,
					children: []
				});
			}

			familiesMap.get(familyKey)!.children.push(childHandle);
		}

		// Also create couple-only families for spouses without children
		for (const person of people) {
			const personHandle = context.personHandles.get(person.crId);
			if (!personHandle) continue;

			if (person.spouseCrIds && person.spouseCrIds.length > 0) {
				for (const spouseId of person.spouseCrIds) {
					const spouseHandle = context.personHandles.get(spouseId);
					if (!spouseHandle) continue;

					// Sort handles to create consistent key
					const [h1, h2] = [personHandle, spouseHandle].sort();
					const familyKey = `${h1}:${h2}`;

					if (!familiesMap.has(familyKey)) {
						// Determine who is father/mother based on sex
						const personData = people.find(p => p.crId === person.crId);
						const spouseData = people.find(p => p.crId === spouseId);

						let father: string | undefined;
						let mother: string | undefined;

						if (personData?.sex === 'M') {
							father = personHandle;
							mother = spouseHandle;
						} else if (personData?.sex === 'F') {
							father = spouseHandle;
							mother = personHandle;
						} else if (spouseData?.sex === 'M') {
							father = spouseHandle;
							mother = personHandle;
						} else if (spouseData?.sex === 'F') {
							father = personHandle;
							mother = spouseHandle;
						} else {
							// Unknown sex, just assign arbitrarily
							father = h1;
							mother = h2;
						}

						familiesMap.set(familyKey, {
							father,
							mother,
							children: []
						});
					}
				}
			}
		}

		// Build families from step-parent relationships
		const stepFamiliesMap = new Map<string, {
			father?: string;
			mother?: string;
			childRefs: ChildRef[];
		}>();

		for (const person of people) {
			const childHandle = context.personHandles.get(person.crId);
			if (!childHandle) continue;

			// Step-fathers
			if (person.stepfatherCrIds && person.stepfatherCrIds.length > 0) {
				for (const stepfatherId of person.stepfatherCrIds) {
					const stepfatherHandle = context.personHandles.get(stepfatherId);
					if (!stepfatherHandle) continue;

					const familyKey = `step_${stepfatherHandle}_none`;
					if (!stepFamiliesMap.has(familyKey)) {
						stepFamiliesMap.set(familyKey, {
							father: stepfatherHandle,
							childRefs: []
						});
					}
					stepFamiliesMap.get(familyKey)!.childRefs.push({
						handle: childHandle,
						frel: 'Stepchild'
					});
				}
			}

			// Step-mothers
			if (person.stepmotherCrIds && person.stepmotherCrIds.length > 0) {
				for (const stepmotherId of person.stepmotherCrIds) {
					const stepmotherHandle = context.personHandles.get(stepmotherId);
					if (!stepmotherHandle) continue;

					const familyKey = `step_none_${stepmotherHandle}`;
					if (!stepFamiliesMap.has(familyKey)) {
						stepFamiliesMap.set(familyKey, {
							mother: stepmotherHandle,
							childRefs: []
						});
					}
					stepFamiliesMap.get(familyKey)!.childRefs.push({
						handle: childHandle,
						mrel: 'Stepchild'
					});
				}
			}
		}

		// Build families from adoptive parent relationships
		const adoptiveFamiliesMap = new Map<string, {
			father?: string;
			mother?: string;
			childRefs: ChildRef[];
		}>();

		for (const person of people) {
			const childHandle = context.personHandles.get(person.crId);
			if (!childHandle) continue;

			if (person.adoptiveFatherCrId || person.adoptiveMotherCrId) {
				const adoptiveFatherHandle = person.adoptiveFatherCrId
					? context.personHandles.get(person.adoptiveFatherCrId)
					: undefined;
				const adoptiveMotherHandle = person.adoptiveMotherCrId
					? context.personHandles.get(person.adoptiveMotherCrId)
					: undefined;

				if (!adoptiveFatherHandle && !adoptiveMotherHandle) continue;

				const familyKey = `adop_${adoptiveFatherHandle || 'none'}_${adoptiveMotherHandle || 'none'}`;
				if (!adoptiveFamiliesMap.has(familyKey)) {
					adoptiveFamiliesMap.set(familyKey, {
						father: adoptiveFatherHandle,
						mother: adoptiveMotherHandle,
						childRefs: []
					});
				}

				const childRef: ChildRef = { handle: childHandle };
				if (adoptiveFatherHandle) childRef.frel = 'Adopted';
				if (adoptiveMotherHandle) childRef.mrel = 'Adopted';
				adoptiveFamiliesMap.get(familyKey)!.childRefs.push(childRef);
			}
		}

		// Convert to FamilyData array and assign handles
		const familyDataList: FamilyData[] = [];

		// Add biological families
		familiesMap.forEach((family, key) => {
			const familyHandle = `_f${this.generateHandle(context)}`;
			context.familyHandles.set(key, familyHandle);

			familyDataList.push({
				handle: familyHandle,
				key,
				father: family.father,
				mother: family.mother,
				children: family.children
			});
		});

		// Add step-parent families
		stepFamiliesMap.forEach((family, key) => {
			const familyHandle = `_f${this.generateHandle(context)}`;
			context.familyHandles.set(key, familyHandle);

			familyDataList.push({
				handle: familyHandle,
				key,
				father: family.father,
				mother: family.mother,
				children: [], // Use childRefs instead
				childRefs: family.childRefs
			});
		});

		// Add adoptive parent families
		adoptiveFamiliesMap.forEach((family, key) => {
			const familyHandle = `_f${this.generateHandle(context)}`;
			context.familyHandles.set(key, familyHandle);

			familyDataList.push({
				handle: familyHandle,
				key,
				father: family.father,
				mother: family.mother,
				children: [], // Use childRefs instead
				childRefs: family.childRefs
			});
		});

		return familyDataList;
	}

	/**
	 * Build families XML from pre-extracted family data
	 */
	private buildFamiliesXml(
		familyData: FamilyData[],
		context: GrampsExportContext
	): { xml: string; count: number } {
		if (familyData.length === 0) {
			return { xml: '  <families/>', count: 0 };
		}

		const familyLines: string[] = [];
		let familyCounter = 1;

		for (const family of familyData) {
			familyLines.push(`    <family handle="${family.handle}" id="F${familyCounter++}">`);
			familyLines.push('      <rel type="Married"/>');
			if (family.father) {
				familyLines.push(`      <father hlink="${family.father}"/>`);
			}
			if (family.mother) {
				familyLines.push(`      <mother hlink="${family.mother}"/>`);
			}
			// Use childRefs if available (with mrel/frel), otherwise use children array
			if (family.childRefs && family.childRefs.length > 0) {
				for (const childRef of family.childRefs) {
					let attrs = `hlink="${childRef.handle}"`;
					if (childRef.mrel && childRef.mrel !== 'Birth') {
						attrs += ` mrel="${childRef.mrel}"`;
					}
					if (childRef.frel && childRef.frel !== 'Birth') {
						attrs += ` frel="${childRef.frel}"`;
					}
					familyLines.push(`      <childref ${attrs}/>`);
				}
			} else {
				for (const childHandle of family.children) {
					familyLines.push(`      <childref hlink="${childHandle}"/>`);
				}
			}
			familyLines.push('    </family>');
		}

		return {
			xml: '  <families>\n' + familyLines.join('\n') + '\n  </families>',
			count: familyCounter - 1
		};
	}

	/**
	 * Generate a unique handle
	 */
	private generateHandle(context: GrampsExportContext): string {
		const id = context.handleCounter++;
		return id.toString(36).padStart(10, '0');
	}

	/**
	 * Get or create a place handle
	 * If the place doesn't exist in placeHandles (from PlaceGraphService),
	 * creates a new handle and tracks it in additionalPlaces for XML output
	 */
	private getOrCreatePlace(placeName: string, context: GrampsExportContext): string {
		if (context.placeHandles.has(placeName)) {
			return context.placeHandles.get(placeName)!;
		}

		// Check if we already created this additional place
		if (context.additionalPlaces.has(placeName)) {
			return context.additionalPlaces.get(placeName)!;
		}

		const handle = `_p${this.generateHandle(context)}`;
		context.additionalPlaces.set(placeName, handle);
		return handle;
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
	 * Convert internal sex format to Gramps gender
	 */
	private convertGender(sex?: string): string {
		if (!sex) return 'U';

		const normalized = sex.toLowerCase();
		if (normalized === 'm' || normalized === 'male') return 'M';
		if (normalized === 'f' || normalized === 'female') return 'F';
		if (normalized === 'nonbinary' || normalized === 'unknown') return 'U';
		return 'U';
	}

	/**
	 * Parse name into first and surname
	 */
	private parseNameParts(
		fullName: string,
		isProtected: boolean
	): { first?: string; surname?: string } {
		if (isProtected) {
			return { first: fullName };
		}

		const parts = fullName.trim().split(/\s+/);
		if (parts.length === 1) {
			return { first: parts[0] };
		}

		const surname = parts.pop()!;
		const first = parts.join(' ');
		return { first, surname };
	}

	/**
	 * Format date for Gramps XML
	 */
	private formatDateForGramps(dateString: string): string {
		// Try to parse ISO format
		const isoMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/);
		if (isoMatch) {
			return dateString;
		}

		// Try to extract just year
		const yearMatch = dateString.match(/\b(1[89][0-9]{2}|20[0-9]{2})\b/);
		if (yearMatch) {
			return yearMatch[1];
		}

		// Return as-is
		return dateString;
	}

	/**
	 * Escape special XML characters
	 */
	private escapeXml(str: string): string {
		return str
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&apos;');
	}

	/**
	 * Map Canvas Roots event type to Gramps event type
	 */
	private eventTypeToGrampsType(eventType: string): string {
		const mapping: Record<string, string> = {
			'birth': 'Birth',
			'death': 'Death',
			'marriage': 'Marriage',
			'divorce': 'Divorce',
			'burial': 'Burial',
			'cremation': 'Cremation',
			'adoption': 'Adoption',
			'baptism': 'Baptism',
			'christening': 'Baptism',
			'confirmation': 'Confirmation',
			'ordination': 'Ordination',
			'graduation': 'Graduation',
			'retirement': 'Retirement',
			'residence': 'Residence',
			'occupation': 'Occupation',
			'education': 'Education',
			'military': 'Military Service',
			'immigration': 'Immigration',
			'emigration': 'Emigration',
			'naturalization': 'Naturalization',
			'census': 'Census',
			'probate': 'Probate',
			'will': 'Will',
			'engagement': 'Engagement',
			'annulment': 'Annulment',
			'bar_mitzvah': 'Bar Mitzvah',
			'bas_mitzvah': 'Bas Mitzvah',
			'blessing': 'Blessing',
			'first_communion': 'First Communion'
		};

		// Return mapped type, or use the original event type if not mapped
		return mapping[eventType] || eventType.charAt(0).toUpperCase() + eventType.slice(1);
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
