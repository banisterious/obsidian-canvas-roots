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
	handleCounter: number;
}

/**
 * Export person notes to Gramps XML format
 */
export class GrampsExporter {
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

			// Build Gramps XML document
			new Notice('Generating Gramps XML data...');
			const xmlContent = this.buildGrampsXml(
				filteredPeople,
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
		options: GrampsExportOptions,
		privacyService: PrivacyService | null
	): { xml: string; familyCount: number; eventCount: number } {
		const context: GrampsExportContext = {
			personHandles: new Map(),
			eventHandles: new Map(),
			familyHandles: new Map(),
			placeHandles: new Map(),
			handleCounter: 1
		};

		// Generate handles for all people first
		people.forEach(person => {
			const handle = `_${this.generateHandle(context)}`;
			context.personHandles.set(person.crId, handle);
		});

		// Build XML sections
		const events = this.buildEvents(people, context, privacyService);
		const places = this.buildPlaces(people, context);
		const persons = this.buildPersons(people, context, privacyService);
		const families = this.buildFamilies(people, context);

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
${events.xml}
${places.xml}
${persons.xml}
${families.xml}
</database>
`;

		return {
			xml,
			familyCount: families.count,
			eventCount: events.count
		};
	}

	/**
	 * Build events section
	 */
	private buildEvents(
		people: PersonNode[],
		context: GrampsExportContext,
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

		if (eventLines.length === 0) {
			return { xml: '  <events/>', count: 0 };
		}

		return {
			xml: '  <events>\n' + eventLines.join('\n') + '\n  </events>',
			count: eventCounter - 1
		};
	}

	/**
	 * Build places section
	 */
	private buildPlaces(
		people: PersonNode[],
		context: GrampsExportContext
	): { xml: string } {
		// Places are created on-demand in buildEvents, so just format them
		if (context.placeHandles.size === 0) {
			return { xml: '  <places/>' };
		}

		const placeLines: string[] = [];
		let placeCounter = 1;

		context.placeHandles.forEach((handle, placeName) => {
			placeLines.push(`    <placeobj handle="${handle}" id="P${placeCounter++}">`);
			placeLines.push(`      <ptitle>${this.escapeXml(placeName)}</ptitle>`);
			placeLines.push(`      <pname value="${this.escapeXml(placeName)}"/>`);
			placeLines.push('    </placeobj>');
		});

		return {
			xml: '  <places>\n' + placeLines.join('\n') + '\n  </places>'
		};
	}

	/**
	 * Build persons section
	 */
	private buildPersons(
		people: PersonNode[],
		context: GrampsExportContext,
		privacyService: PrivacyService | null
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

			// Gender
			const gender = this.convertGender(person.sex);
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

			// Family references (childof and parentin) - added after families are built
			// For now, just close the person tag
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
	 * Generate a unique handle
	 */
	private generateHandle(context: GrampsExportContext): string {
		const id = context.handleCounter++;
		return id.toString(36).padStart(10, '0');
	}

	/**
	 * Get or create a place handle
	 */
	private getOrCreatePlace(placeName: string, context: GrampsExportContext): string {
		if (context.placeHandles.has(placeName)) {
			return context.placeHandles.get(placeName)!;
		}

		const handle = `_p${this.generateHandle(context)}`;
		context.placeHandles.set(placeName, handle);
		return handle;
	}

	/**
	 * Convert internal sex format to Gramps gender
	 */
	private convertGender(sex?: string): string {
		if (!sex) return 'U';

		const normalized = sex.toUpperCase();
		if (normalized === 'M' || normalized === 'MALE') return 'M';
		if (normalized === 'F' || normalized === 'FEMALE') return 'F';
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
}
