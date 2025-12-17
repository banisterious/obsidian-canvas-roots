/**
 * GEDCOM 5.5.1 Parser v2 for Canvas Roots
 *
 * Extended parser that captures events, sources, and person attributes
 * in addition to basic person and family data.
 */

import {
	GedcomDataV2,
	GedcomIndividualV2,
	GedcomFamilyV2,
	GedcomSource,
	GedcomEvent,
	GedcomSourceCitation,
	FamilyAsChildRef,
	isIndividualEventTag,
	isFamilyEventTag,
	isAttributeTag,
	getEventTypeFromTag,
	getPropertyFromAttributeTag,
	parseDatePrecision,
	parseDateRange,
	getPedigreeType
} from './gedcom-types';
import { GedcomParser, GedcomParseError, GedcomValidationResult } from './gedcom-parser';

/**
 * GEDCOM line structure
 */
interface GedcomLine {
	level: number;
	tag: string;
	value: string;
	xref?: string;
	lineNumber: number;
}

/**
 * Extended GEDCOM Parser (v2)
 *
 * Parses GEDCOM files and extracts:
 * - Individuals with all events and attributes
 * - Families with all events
 * - Source records
 */
export class GedcomParserV2 {
	/**
	 * Validate GEDCOM content (delegates to v1 parser)
	 */
	static validate(content: string): GedcomValidationResult {
		return GedcomParser.validate(content);
	}

	/**
	 * Convert GEDCOM date to ISO format (delegates to v1 parser)
	 */
	static gedcomDateToISO(gedcomDate: string): string | undefined {
		return GedcomParser.gedcomDateToISO(gedcomDate);
	}

	/**
	 * Parse GEDCOM content into structured data (v2)
	 */
	static parse(content: string): GedcomDataV2 {
		const lines = this.parseLines(content);
		const data: GedcomDataV2 = {
			individuals: new Map(),
			families: new Map(),
			sources: new Map(),
			header: {}
		};

		let currentRecord: 'INDI' | 'FAM' | 'SOUR' | 'HEAD' | null = null;
		let currentIndividual: GedcomIndividualV2 | null = null;
		let currentFamily: GedcomFamilyV2 | null = null;
		let currentSource: GedcomSource | null = null;
		let currentEvent: GedcomEvent | null = null;
		let currentCitation: GedcomSourceCitation | null = null;
		let currentFamcRef: FamilyAsChildRef | undefined = undefined;
		let contextStack: string[] = [];

		for (const line of lines) {
			// Level 0 records - start of new record
			if (line.level === 0) {
				// Save previous records
				this.saveCurrentRecords(data, currentIndividual, currentFamily, currentSource, currentEvent);

				// Reset state
				currentIndividual = null;
				currentFamily = null;
				currentSource = null;
				currentEvent = null;
				currentCitation = null;
				currentFamcRef = undefined;
				contextStack = [];

				if (line.tag === 'HEAD') {
					currentRecord = 'HEAD';
				} else if (line.xref && line.tag === 'INDI') {
					currentRecord = 'INDI';
					currentIndividual = this.createEmptyIndividual(line.xref);
				} else if (line.xref && line.tag === 'FAM') {
					currentRecord = 'FAM';
					currentFamily = this.createEmptyFamily(line.xref);
				} else if (line.xref && line.tag === 'SOUR') {
					currentRecord = 'SOUR';
					currentSource = this.createEmptySource(line.xref);
				} else if (line.tag === 'TRLR') {
					currentRecord = null;
				}
				continue;
			}

			// Update context stack based on level
			while (contextStack.length >= line.level) {
				contextStack.pop();
			}
			contextStack.push(line.tag);

			// Process based on current record type
			switch (currentRecord) {
				case 'HEAD':
					this.parseHeaderLine(line, data.header);
					break;

				case 'INDI':
					if (currentIndividual) {
						const result = this.parseIndividualLine(
							line,
							currentIndividual,
							currentEvent,
							currentCitation,
							contextStack,
							currentFamcRef
						);
						currentEvent = result.currentEvent;
						currentCitation = result.currentCitation;
						currentFamcRef = result.currentFamcRef;
					}
					break;

				case 'FAM':
					if (currentFamily) {
						const result = this.parseFamilyLine(
							line,
							currentFamily,
							currentEvent,
							currentCitation,
							contextStack
						);
						currentEvent = result.currentEvent;
						currentCitation = result.currentCitation;
					}
					break;

				case 'SOUR':
					if (currentSource) {
						this.parseSourceLine(line, currentSource);
					}
					break;
			}
		}

		// Save final records
		this.saveCurrentRecords(data, currentIndividual, currentFamily, currentSource, currentEvent);

		// Link families to individuals
		this.linkFamilies(data);

		return data;
	}

	// ============================================================================
	// Private: Line Parsing
	// ============================================================================

	/**
	 * Parse raw GEDCOM lines
	 */
	private static parseLines(content: string): GedcomLine[] {
		const lines = content.split(/\r?\n/);
		const parsed: GedcomLine[] = [];

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i].trim();
			if (!line) continue;

			const match = line.match(/^(\d+)\s+(@[^@]+@\s+)?(\S+)(\s+(.*))?$/);
			if (!match) {
				throw new GedcomParseError(`Invalid GEDCOM line format`, i + 1);
			}

			parsed.push({
				level: parseInt(match[1]),
				xref: match[2]?.trim().replace(/@/g, ''),
				tag: match[3],
				value: match[5]?.trim() || '',
				lineNumber: i + 1
			});
		}

		return parsed;
	}

	// ============================================================================
	// Private: Record Creation
	// ============================================================================

	private static createEmptyIndividual(id: string): GedcomIndividualV2 {
		return {
			id,
			name: '',
			spouseRefs: [],
			familyAsChildRefs: [],
			familyAsSpouseRefs: [],
			events: [],
			attributes: {}
		};
	}

	private static createEmptyFamily(id: string): GedcomFamilyV2 {
		return {
			id,
			childRefs: [],
			events: []
		};
	}

	private static createEmptySource(id: string): GedcomSource {
		return { id };
	}

	private static createEmptyEvent(tag: string, isFamilyEvent: boolean): GedcomEvent {
		return {
			tag,
			eventType: getEventTypeFromTag(tag),
			datePrecision: 'unknown',
			sourceRefs: [],
			sourceCitations: [],
			isFamilyEvent
		};
	}

	// ============================================================================
	// Private: Record Saving
	// ============================================================================

	private static saveCurrentRecords(
		data: GedcomDataV2,
		individual: GedcomIndividualV2 | null,
		family: GedcomFamilyV2 | null,
		source: GedcomSource | null,
		event: GedcomEvent | null
	): void {
		// Save pending event to its parent
		if (event) {
			if (event.isFamilyEvent && family) {
				family.events.push(event);
			} else if (!event.isFamilyEvent && individual) {
				individual.events.push(event);
			}
		}

		// Save records to data
		if (individual && individual.id) {
			data.individuals.set(individual.id, individual);
		}
		if (family && family.id) {
			data.families.set(family.id, family);
		}
		if (source && source.id) {
			data.sources.set(source.id, source);
		}
	}

	// ============================================================================
	// Private: Header Parsing
	// ============================================================================

	private static parseHeaderLine(line: GedcomLine, header: GedcomDataV2['header']): void {
		switch (line.tag) {
			case 'SOUR':
				header.source = line.value;
				break;
			case 'VERS':
				header.version = line.value;
				break;
			case 'DATE':
				header.date = line.value;
				break;
			case 'FILE':
				header.fileName = line.value;
				break;
		}
	}

	// ============================================================================
	// Private: Individual Parsing
	// ============================================================================

	private static parseIndividualLine(
		line: GedcomLine,
		individual: GedcomIndividualV2,
		currentEvent: GedcomEvent | null,
		currentCitation: GedcomSourceCitation | null,
		contextStack: string[],
		currentFamcRef?: FamilyAsChildRef
	): {
		currentEvent: GedcomEvent | null;
		currentCitation: GedcomSourceCitation | null;
		currentFamcRef?: FamilyAsChildRef;
	} {
		const tag = line.tag;
		const value = line.value;
		const level = line.level;

		// Level 1: Top-level tags on individual
		if (level === 1) {
			// Save previous event if exists
			if (currentEvent) {
				individual.events.push(currentEvent);
				currentEvent = null;
			}
			currentCitation = null;

			// Check if this is an event tag
			if (isIndividualEventTag(tag)) {
				currentEvent = this.createEmptyEvent(tag, false);
				currentEvent.individualRef = individual.id;

				// Some events have inline value (e.g., "1 OCCU Farmer")
				if (value) {
					currentEvent.description = value;
				}
				return { currentEvent, currentCitation, currentFamcRef: undefined };
			}

			// Check if this is an attribute tag
			if (isAttributeTag(tag)) {
				const propName = getPropertyFromAttributeTag(tag);
				if (propName && value) {
					individual.attributes[propName] = value;
				}
				return { currentEvent, currentCitation, currentFamcRef: undefined };
			}

			// Basic individual fields
			switch (tag) {
				case 'NAME':
					individual.name = value.replace(/\//g, '');
					break;
				case 'SEX':
					individual.sex = value === 'M' ? 'M' : value === 'F' ? 'F' : 'U';
					break;
				case 'FAMC': {
					// Start a new FAMC record - default pedigree is 'birth'
					const familyRef = value.replace(/@/g, '');
					currentFamcRef = { familyRef, pedigree: 'birth' };
					individual.familyAsChildRefs.push(currentFamcRef);
					// Keep deprecated field for backward compatibility (first biological family only)
					if (!individual.familyAsChildRef) {
						individual.familyAsChildRef = familyRef;
					}
					return { currentEvent, currentCitation, currentFamcRef };
				}
				case 'FAMS':
					individual.familyAsSpouseRefs.push(value.replace(/@/g, ''));
					break;
			}

			return { currentEvent, currentCitation, currentFamcRef: undefined };
		}

		// Level 2: Sub-tags under events, NAME, or FAMC
		if (level === 2) {
			currentCitation = null;

			// PEDI tag under FAMC - update the pedigree type
			if (tag === 'PEDI' && currentFamcRef) {
				currentFamcRef.pedigree = getPedigreeType(value);
				// Update deprecated familyAsChildRef - only keep first biological family
				if (currentFamcRef.pedigree !== 'birth' && individual.familyAsChildRef === currentFamcRef.familyRef) {
					// This was set as biological but is actually step/adopted/foster
					// Find the first actual biological family or clear it
					const firstBiological = individual.familyAsChildRefs.find(f => f.pedigree === 'birth' && f !== currentFamcRef);
					individual.familyAsChildRef = firstBiological?.familyRef;
				}
				return { currentEvent, currentCitation, currentFamcRef };
			}

			// Under an event
			if (currentEvent) {
				switch (tag) {
					case 'DATE': {
						currentEvent.dateRaw = value;
						const { datePrecision, cleanedDate } = parseDatePrecision(value);
						currentEvent.datePrecision = datePrecision;

						// Check for date range
						const range = parseDateRange(value);
						if (range) {
							currentEvent.date = this.gedcomDateToISO(range.startDate);
							if (range.endDate) {
								currentEvent.dateEnd = this.gedcomDateToISO(range.endDate);
							}
						} else {
							currentEvent.date = this.gedcomDateToISO(cleanedDate);
						}

						// Also update core dates on individual for compatibility
						if (currentEvent.tag === 'BIRT') {
							individual.birthDate = value;
						} else if (currentEvent.tag === 'DEAT') {
							individual.deathDate = value;
						}
						break;
					}

					case 'PLAC':
						currentEvent.place = value;
						// Also update core places on individual for compatibility
						if (currentEvent.tag === 'BIRT') {
							individual.birthPlace = value;
						} else if (currentEvent.tag === 'DEAT') {
							individual.deathPlace = value;
						}
						break;

					case 'SOUR': {
						// Start a source citation
						const sourceRef = value.replace(/@/g, '');
						currentCitation = {
							sourceRef
						};
						currentEvent.sourceRefs.push(sourceRef);
						currentEvent.sourceCitations.push(currentCitation);
						break;
					}

					case 'NOTE':
						if (!currentEvent.description) {
							currentEvent.description = value;
						} else {
							currentEvent.description += '\n' + value;
						}
						break;
				}
			} else {
				// Level 2 under NAME
				if (contextStack[0] === 'NAME') {
					switch (tag) {
						case 'GIVN':
							individual.givenName = value;
							break;
						case 'SURN':
							individual.surname = value;
							break;
					}
				}
			}

			return { currentEvent, currentCitation, currentFamcRef };
		}

		// Level 3: Sub-tags under source citations
		if (level === 3 && currentCitation) {
			switch (tag) {
				case 'PAGE':
					currentCitation.page = value;
					break;
				case 'QUAY': {
					const quay = parseInt(value, 10);
					if (!isNaN(quay)) {
						currentCitation.quay = quay;
					}
					break;
				}
			}
		}

		return { currentEvent, currentCitation, currentFamcRef };
	}

	// ============================================================================
	// Private: Family Parsing
	// ============================================================================

	private static parseFamilyLine(
		line: GedcomLine,
		family: GedcomFamilyV2,
		currentEvent: GedcomEvent | null,
		currentCitation: GedcomSourceCitation | null,
		contextStack: string[]
	): { currentEvent: GedcomEvent | null; currentCitation: GedcomSourceCitation | null } {
		const tag = line.tag;
		const value = line.value;
		const level = line.level;

		// Level 1: Top-level tags on family
		if (level === 1) {
			// Save previous event if exists
			if (currentEvent) {
				family.events.push(currentEvent);
				currentEvent = null;
			}
			currentCitation = null;

			// Check if this is a family event tag
			if (isFamilyEventTag(tag)) {
				currentEvent = this.createEmptyEvent(tag, true);
				currentEvent.spouse1Ref = family.husbandRef;
				currentEvent.spouse2Ref = family.wifeRef;
				return { currentEvent, currentCitation };
			}

			// Basic family fields
			switch (tag) {
				case 'HUSB':
					family.husbandRef = value.replace(/@/g, '');
					break;
				case 'WIFE':
					family.wifeRef = value.replace(/@/g, '');
					break;
				case 'CHIL':
					family.childRefs.push(value.replace(/@/g, ''));
					break;
			}

			return { currentEvent, currentCitation };
		}

		// Level 2: Sub-tags under events
		if (level === 2 && currentEvent) {
			currentCitation = null;

			switch (tag) {
				case 'DATE': {
					currentEvent.dateRaw = value;
					const { datePrecision, cleanedDate } = parseDatePrecision(value);
					currentEvent.datePrecision = datePrecision;

					// Check for date range
					const range = parseDateRange(value);
					if (range) {
						currentEvent.date = this.gedcomDateToISO(range.startDate);
						if (range.endDate) {
							currentEvent.dateEnd = this.gedcomDateToISO(range.endDate);
						}
					} else {
						currentEvent.date = this.gedcomDateToISO(cleanedDate);
					}

					// Also update core date on family for compatibility
					if (currentEvent.tag === 'MARR') {
						family.marriageDate = value;
					}
					break;
				}

				case 'PLAC':
					currentEvent.place = value;
					// Also update core place on family for compatibility
					if (currentEvent.tag === 'MARR') {
						family.marriagePlace = value;
					}
					break;

				case 'SOUR': {
					// Start a source citation
					const sourceRef = value.replace(/@/g, '');
					currentCitation = {
						sourceRef
					};
					currentEvent.sourceRefs.push(sourceRef);
					currentEvent.sourceCitations.push(currentCitation);
					break;
				}

				case 'NOTE':
					if (!currentEvent.description) {
						currentEvent.description = value;
					} else {
						currentEvent.description += '\n' + value;
					}
					break;
			}

			return { currentEvent, currentCitation };
		}

		// Level 3: Sub-tags under source citations
		if (level === 3 && currentCitation) {
			switch (tag) {
				case 'PAGE':
					currentCitation.page = value;
					break;
				case 'QUAY': {
					const quay = parseInt(value, 10);
					if (!isNaN(quay)) {
						currentCitation.quay = quay;
					}
					break;
				}
			}
		}

		return { currentEvent, currentCitation };
	}

	// ============================================================================
	// Private: Source Parsing
	// ============================================================================

	private static parseSourceLine(line: GedcomLine, source: GedcomSource): void {
		switch (line.tag) {
			case 'TITL':
				source.title = line.value;
				break;
			case 'AUTH':
				source.author = line.value;
				break;
			case 'PUBL':
				source.publisher = line.value;
				break;
			case 'REPO':
				source.repositoryRef = line.value.replace(/@/g, '');
				break;
			case 'NOTE':
				if (!source.notes) {
					source.notes = line.value;
				} else {
					source.notes += '\n' + line.value;
				}
				break;
		}
	}

	// ============================================================================
	// Private: Family Linking
	// ============================================================================

	private static linkFamilies(data: GedcomDataV2): void {
		for (const family of data.families.values()) {
			// Link parents to children - but only set fatherRef/motherRef for biological relationships
			for (const childRef of family.childRefs) {
				const child = data.individuals.get(childRef);
				if (child) {
					// Find the pedigree type for this child's relationship to this family
					const famcRef = child.familyAsChildRefs.find(f => f.familyRef === family.id);
					const pedigree = famcRef?.pedigree || 'birth'; // Default to birth if not specified

					// Only set fatherRef/motherRef for biological parents
					if (pedigree === 'birth') {
						if (family.husbandRef) {
							child.fatherRef = family.husbandRef;
						}
						if (family.wifeRef) {
							child.motherRef = family.wifeRef;
						}
					}
					// Note: Step-parents, adoptive parents, and foster parents are tracked
					// via the familyAsChildRefs array with their pedigree type.
					// The importer (gedcom-importer-v2.ts) will use this to write to
					// the appropriate frontmatter fields (stepfather_id, adoptive_mother_id, etc.)
				}
			}

			// Link spouses
			if (family.husbandRef && family.wifeRef) {
				const husband = data.individuals.get(family.husbandRef);
				const wife = data.individuals.get(family.wifeRef);

				if (husband && !husband.spouseRefs.includes(family.wifeRef)) {
					husband.spouseRefs.push(family.wifeRef);
				}
				if (wife && !wife.spouseRefs.includes(family.husbandRef)) {
					wife.spouseRefs.push(family.husbandRef);
				}
			}

			// Update family events with spouse references (in case HUSB/WIFE came after events)
			for (const event of family.events) {
				if (!event.spouse1Ref) event.spouse1Ref = family.husbandRef;
				if (!event.spouse2Ref) event.spouse2Ref = family.wifeRef;
			}
		}
	}
}
