/**
 * CSV Exporter for Charted Roots
 *
 * Exports person notes from Obsidian vault to CSV format.
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

const logger = getLogger('CsvExporter');

/**
 * Available CSV columns for export
 */
export type CsvColumn =
	| 'cr_id'
	| 'name'
	| 'birth_date'
	| 'death_date'
	| 'birth_place'
	| 'death_place'
	| 'sex'
	| 'gender_identity'
	| 'occupation'
	| 'father_id'
	| 'father_name'
	| 'mother_id'
	| 'mother_name'
	| 'spouse_ids'
	| 'spouse_names'
	| 'collection'
	| 'file_path';

/**
 * Default columns for CSV export
 */
export const DEFAULT_CSV_COLUMNS: CsvColumn[] = [
	'cr_id',
	'name',
	'birth_date',
	'death_date',
	'birth_place',
	'death_place',
	'sex',
	'occupation',
	'father_id',
	'father_name',
	'mother_id',
	'mother_name',
	'spouse_ids',
	'spouse_names',
	'collection'
];

/**
 * Human-readable column headers
 */
export const CSV_COLUMN_HEADERS: Record<CsvColumn, string> = {
	cr_id: 'ID',
	name: 'Name',
	birth_date: 'Birth Date',
	death_date: 'Death Date',
	birth_place: 'Birth Place',
	death_place: 'Death Place',
	sex: 'Sex',
	gender_identity: 'Gender Identity',
	occupation: 'Occupation',
	father_id: 'Father ID',
	father_name: 'Father Name',
	mother_id: 'Mother ID',
	mother_name: 'Mother Name',
	spouse_ids: 'Spouse IDs',
	spouse_names: 'Spouse Names',
	collection: 'Collection',
	file_path: 'File Path'
};

/**
 * CSV export options
 */
export interface CsvExportOptions {
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

	/** Export filename (without .csv extension) */
	fileName?: string;

	/** Columns to include in export */
	columns?: CsvColumn[];

	/** Include header row */
	includeHeader?: boolean;

	/** Field delimiter (default: comma) */
	delimiter?: string;

	/** Privacy settings for protecting living persons */
	privacySettings?: PrivacySettings;
}

/**
 * CSV export result
 */
export interface CsvExportResult {
	success: boolean;
	recordsExported: number;
	errors: string[];
	csvContent?: string;
	fileName: string;
	/** Number of living persons excluded due to privacy settings */
	privacyExcluded?: number;
	/** Number of living persons with obfuscated data */
	privacyObfuscated?: number;
}

/**
 * Export person notes to CSV format
 */
export class CsvExporter {
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
	 * Export people to CSV format
	 */
	exportToCsv(options: CsvExportOptions): CsvExportResult {
		const result: CsvExportResult = {
			success: false,
			recordsExported: 0,
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
						deathDate: person.deathDate,
						cr_living: person.cr_living
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
							deathDate: person.deathDate,
							cr_living: person.cr_living
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

			// Build person lookup map for resolving relationship names
			const personLookup = new Map<string, PersonNode>();
			for (const person of allPeople) {
				personLookup.set(person.crId, person);
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

			// Build CSV content
			new Notice('Generating CSV data...');
			const csvContent = this.buildCsvContent(
				filteredPeople,
				personLookup,
				allEvents,
				allSources,
				allPlaces,
				options,
				privacyService
			);

			result.csvContent = csvContent;
			result.recordsExported = filteredPeople.length;
			result.success = true;

			new Notice(`Export complete: ${result.recordsExported} people exported`);

		} catch (error: unknown) {
			const errorMsg = getErrorMessage(error);
			result.errors.push(`Export failed: ${errorMsg}`);
			logger.error('export', 'Export failed', error);
			new Notice(`Export failed: ${errorMsg}`);
		}

		return result;
	}

	/**
	 * Build complete CSV content
	 */
	private buildCsvContent(
		people: PersonNode[],
		personLookup: Map<string, PersonNode>,
		events: EventNote[],
		sources: SourceNote[],
		places: PlaceNode[],
		options: CsvExportOptions,
		privacyService: PrivacyService | null
	): string {
		const columns = options.columns || DEFAULT_CSV_COLUMNS;
		const delimiter = options.delimiter || ',';
		const includeHeader = options.includeHeader !== false;

		const lines: string[] = [];

		// Add header row for person records
		if (includeHeader) {
			const headers = columns.map(col => this.escapeField(CSV_COLUMN_HEADERS[col], delimiter));
			lines.push(headers.join(delimiter));
		}

		// Add person data rows
		for (const person of people) {
			const row = this.buildRow(person, personLookup, columns, delimiter, privacyService);
			lines.push(row);
		}

		// Add event records if events are available
		if (events.length > 0) {
			// Add blank line separator
			lines.push('');

			// Add event header row
			if (includeHeader) {
				const eventHeaders = ['Type', 'Person', 'Event Type', 'Date', 'Date Precision', 'Place', 'Description', 'Confidence'];
				lines.push(eventHeaders.map(h => this.escapeField(h, delimiter)).join(delimiter));
			}

			// Add event data rows
			for (const event of events) {
				const eventRow = this.buildEventRow(event, delimiter);
				if (eventRow) {
					lines.push(eventRow);
				}
			}
		}

		// Add source records if sources are available
		if (sources.length > 0) {
			// Add blank line separator
			lines.push('');

			// Add source header row
			if (includeHeader) {
				const sourceHeaders = ['Type', 'ID', 'Title', 'Repository', 'Collection', 'Date', 'Confidence'];
				lines.push(sourceHeaders.map(h => this.escapeField(h, delimiter)).join(delimiter));
			}

			// Add source data rows
			for (const source of sources) {
				const sourceRow = this.buildSourceRow(source, delimiter);
				if (sourceRow) {
					lines.push(sourceRow);
				}
			}
		}

		// Add place records if places are available
		if (places.length > 0) {
			// Add blank line separator
			lines.push('');

			// Add place header row
			if (includeHeader) {
				const placeHeaders = ['Type', 'ID', 'Name', 'Place Type', 'Parent', 'Latitude', 'Longitude', 'Category'];
				lines.push(placeHeaders.map(h => this.escapeField(h, delimiter)).join(delimiter));
			}

			// Add place data rows
			for (const place of places) {
				const placeRow = this.buildPlaceRow(place, places, delimiter);
				if (placeRow) {
					lines.push(placeRow);
				}
			}
		}

		return lines.join('\n');
	}

	/**
	 * Build a single CSV row for a person
	 */
	private buildRow(
		person: PersonNode,
		personLookup: Map<string, PersonNode>,
		columns: CsvColumn[],
		delimiter: string,
		privacyService: PrivacyService | null
	): string {
		// Check privacy status
		const privacyResult = privacyService?.applyPrivacy({
			name: person.name,
			birthDate: person.birthDate,
			deathDate: person.deathDate,
			cr_living: person.cr_living
		});

		const fields: string[] = [];

		for (const column of columns) {
			let value = '';

			switch (column) {
				case 'cr_id':
					value = person.crId;
					break;

				case 'name':
					value = privacyResult?.isProtected
						? privacyResult.displayName
						: (person.name || '');
					break;

				case 'birth_date':
					if (privacyResult?.isProtected && !privacyResult.showBirthDate) {
						value = '';
					} else {
						value = person.birthDate || '';
					}
					break;

				case 'death_date':
					value = person.deathDate || '';
					break;

				case 'birth_place':
					if (privacyResult?.isProtected && !privacyResult.showBirthPlace) {
						value = '';
					} else {
						value = person.birthPlace || '';
					}
					break;

				case 'death_place':
					value = person.deathPlace || '';
					break;

				case 'sex':
					value = this.resolveSexValue(person) || '';
					break;

				case 'gender_identity':
					if (privacyResult?.isProtected) {
						value = '';
					} else {
						value = this.resolveGenderIdentityValue(person) || '';
					}
					break;

				case 'occupation':
					if (privacyResult?.isProtected) {
						value = '';
					} else {
						value = person.occupation || '';
					}
					break;

				case 'father_id':
					value = person.fatherCrId || '';
					break;

				case 'father_name':
					if (person.fatherCrId) {
						const father = personLookup.get(person.fatherCrId);
						value = father?.name || '';
					}
					break;

				case 'mother_id':
					value = person.motherCrId || '';
					break;

				case 'mother_name':
					if (person.motherCrId) {
						const mother = personLookup.get(person.motherCrId);
						value = mother?.name || '';
					}
					break;

				case 'spouse_ids':
					value = person.spouseCrIds.join('; ');
					break;

				case 'spouse_names':
					value = person.spouseCrIds
						.map(id => personLookup.get(id)?.name || '')
						.filter(name => name)
						.join('; ');
					break;

				case 'collection':
					value = person.collection || '';
					break;

				case 'file_path':
					value = person.file.path;
					break;
			}

			fields.push(this.escapeField(value, delimiter));
		}

		return fields.join(delimiter);
	}

	/**
	 * Resolve sex value using property and value alias services
	 * Returns resolved sex value as string
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
	 * Escape a field value for CSV
	 * Handles quotes, delimiters, and newlines
	 */
	private escapeField(value: string, delimiter: string): string {
		if (!value) return '';

		// Check if field needs quoting
		const needsQuoting = value.includes(delimiter) ||
			value.includes('"') ||
			value.includes('\n') ||
			value.includes('\r');

		if (needsQuoting) {
			// Escape existing quotes by doubling them
			const escaped = value.replace(/"/g, '""');
			return `"${escaped}"`;
		}

		return value;
	}

	/**
	 * Build a single CSV row for an event
	 * Format: Type,Person,Event Type,Date,Date Precision,Place,Description,Confidence
	 */
	private buildEventRow(event: EventNote, delimiter: string): string | null {
		const fields: string[] = [];

		// Type column - always "event"
		fields.push(this.escapeField('event', delimiter));

		// Person column - use person field or first person from persons array
		const personLink = event.person || (event.persons && event.persons.length > 0 ? event.persons[0] : '');
		fields.push(this.escapeField(personLink, delimiter));

		// Event Type column
		fields.push(this.escapeField(event.eventType || '', delimiter));

		// Date column
		fields.push(this.escapeField(event.date || '', delimiter));

		// Date Precision column
		fields.push(this.escapeField(event.datePrecision || 'unknown', delimiter));

		// Place column
		const placeLink = event.place || '';
		fields.push(this.escapeField(placeLink, delimiter));

		// Description column
		fields.push(this.escapeField(event.description || event.title || '', delimiter));

		// Confidence column
		fields.push(this.escapeField(event.confidence || 'unknown', delimiter));

		return fields.join(delimiter);
	}

	/**
	 * Build a single CSV row for a source
	 * Format: Type,ID,Title,Repository,Collection,Date,Confidence
	 */
	private buildSourceRow(source: SourceNote, delimiter: string): string | null {
		const fields: string[] = [];

		// Type column - always "source"
		fields.push(this.escapeField('source', delimiter));

		// ID column
		fields.push(this.escapeField(source.crId, delimiter));

		// Title column
		fields.push(this.escapeField(source.title || '', delimiter));

		// Repository column
		fields.push(this.escapeField(source.repository || '', delimiter));

		// Collection column
		fields.push(this.escapeField(source.collection || '', delimiter));

		// Date column (date of original document)
		fields.push(this.escapeField(source.date || '', delimiter));

		// Confidence column
		fields.push(this.escapeField(source.confidence || 'unknown', delimiter));

		return fields.join(delimiter);
	}

	/**
	 * Build a single CSV row for a place
	 * Format: Type,ID,Name,Place Type,Parent,Latitude,Longitude,Category
	 */
	private buildPlaceRow(place: PlaceNode, allPlaces: PlaceNode[], delimiter: string): string | null {
		const fields: string[] = [];

		// Type column - always "place"
		fields.push(this.escapeField('place', delimiter));

		// ID column
		fields.push(this.escapeField(place.id, delimiter));

		// Name column
		fields.push(this.escapeField(place.name, delimiter));

		// Place Type column
		fields.push(this.escapeField(place.placeType || '', delimiter));

		// Parent column - wikilink format if parent exists
		let parentValue = '';
		if (place.parentId) {
			const parent = allPlaces.find(p => p.id === place.parentId);
			if (parent) {
				parentValue = `[[${parent.name}]]`;
			}
		}
		fields.push(this.escapeField(parentValue, delimiter));

		// Latitude column
		const lat = place.coordinates?.lat !== undefined ? String(place.coordinates.lat) : '';
		fields.push(this.escapeField(lat, delimiter));

		// Longitude column
		const long = place.coordinates?.long !== undefined ? String(place.coordinates.long) : '';
		fields.push(this.escapeField(long, delimiter));

		// Category column
		fields.push(this.escapeField(place.category, delimiter));

		return fields.join(delimiter);
	}

	/**
	 * Get available columns for export
	 */
	static getAvailableColumns(): Array<{ value: CsvColumn; label: string }> {
		return (Object.keys(CSV_COLUMN_HEADERS) as CsvColumn[]).map(col => ({
			value: col,
			label: CSV_COLUMN_HEADERS[col]
		}));
	}
}
