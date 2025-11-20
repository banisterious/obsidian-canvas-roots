/**
 * GEDCOM 5.5.1 Parser for Canvas Roots
 *
 * Parses GEDCOM files and converts them to Canvas Roots person data structures.
 */

/**
 * Parsed GEDCOM individual record
 */
export interface GedcomIndividual {
	id: string;
	name: string;
	givenName?: string;
	surname?: string;
	sex?: 'M' | 'F' | 'U';
	birthDate?: string;
	birthPlace?: string;
	deathDate?: string;
	deathPlace?: string;
	fatherRef?: string;
	motherRef?: string;
	spouseRefs: string[];
	familyAsChildRef?: string;
	familyAsSpouseRefs: string[];
}

/**
 * Parsed GEDCOM family record
 */
export interface GedcomFamily {
	id: string;
	husbandRef?: string;
	wifeRef?: string;
	childRefs: string[];
	marriageDate?: string;
	marriagePlace?: string;
}

/**
 * Complete parsed GEDCOM data
 */
export interface GedcomData {
	individuals: Map<string, GedcomIndividual>;
	families: Map<string, GedcomFamily>;
	header: {
		source?: string;
		version?: string;
		date?: string;
		fileName?: string;
	};
}

/**
 * GEDCOM parsing error
 */
export class GedcomParseError extends Error {
	constructor(message: string, public line?: number) {
		super(message);
		this.name = 'GedcomParseError';
	}
}

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
 * Parse a GEDCOM file into structured data
 */
export class GedcomParser {
	/**
	 * Parse GEDCOM content into structured data
	 */
	static parse(content: string): GedcomData {
		const lines = this.parseLines(content);
		const data: GedcomData = {
			individuals: new Map(),
			families: new Map(),
			header: {}
		};

		let currentRecord: 'INDI' | 'FAM' | 'HEAD' | null = null;
		let currentIndividual: GedcomIndividual | null = null;
		let currentFamily: GedcomFamily | null = null;
		let currentContext: string[] = [];

		for (const line of lines) {
			// Level 0 records
			if (line.level === 0) {
				// Save previous record
				if (currentIndividual && currentIndividual.id) {
					data.individuals.set(currentIndividual.id, currentIndividual);
				}
				if (currentFamily && currentFamily.id) {
					data.families.set(currentFamily.id, currentFamily);
				}

				// Start new record
				currentIndividual = null;
				currentFamily = null;
				currentContext = [];

				if (line.tag === 'HEAD') {
					currentRecord = 'HEAD';
				} else if (line.xref && line.tag === 'INDI') {
					currentRecord = 'INDI';
					currentIndividual = {
						id: line.xref,
						name: '',
						spouseRefs: [],
						familyAsSpouseRefs: []
					};
				} else if (line.xref && line.tag === 'FAM') {
					currentRecord = 'FAM';
					currentFamily = {
						id: line.xref,
						childRefs: []
					};
				} else if (line.tag === 'TRLR') {
					currentRecord = null;
				}
				continue;
			}

			// Process based on current record type
			if (currentRecord === 'HEAD') {
				this.parseHeaderLine(line, data.header);
			} else if (currentRecord === 'INDI' && currentIndividual) {
				this.parseIndividualLine(line, currentIndividual, currentContext);
			} else if (currentRecord === 'FAM' && currentFamily) {
				this.parseFamilyLine(line, currentFamily, currentContext);
			}
		}

		// Save last record
		if (currentIndividual && currentIndividual.id) {
			data.individuals.set(currentIndividual.id, currentIndividual);
		}
		if (currentFamily && currentFamily.id) {
			data.families.set(currentFamily.id, currentFamily);
		}

		// Link families to individuals
		this.linkFamilies(data);

		return data;
	}

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

	/**
	 * Parse header line
	 */
	private static parseHeaderLine(line: GedcomLine, header: GedcomData['header']): void {
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

	/**
	 * Parse individual record line
	 */
	private static parseIndividualLine(
		line: GedcomLine,
		individual: GedcomIndividual,
		context: string[]
	): void {
		// Update context for level 1 tags
		if (line.level === 1) {
			context.length = 0;
			context.push(line.tag);
		} else if (line.level === 2) {
			context.length = 1;
			context.push(line.tag);
		}

		switch (line.tag) {
			case 'NAME':
				individual.name = line.value.replace(/\//g, '');
				break;

			case 'GIVN':
				individual.givenName = line.value;
				break;

			case 'SURN':
				individual.surname = line.value;
				break;

			case 'SEX':
				individual.sex = line.value === 'M' ? 'M' : line.value === 'F' ? 'F' : 'U';
				break;

			case 'DATE':
				if (context[0] === 'BIRT') {
					individual.birthDate = line.value;
				} else if (context[0] === 'DEAT') {
					individual.deathDate = line.value;
				}
				break;

			case 'PLAC':
				if (context[0] === 'BIRT') {
					individual.birthPlace = line.value;
				} else if (context[0] === 'DEAT') {
					individual.deathPlace = line.value;
				}
				break;

			case 'FAMC':
				individual.familyAsChildRef = line.value.replace(/@/g, '');
				break;

			case 'FAMS':
				individual.familyAsSpouseRefs.push(line.value.replace(/@/g, ''));
				break;
		}
	}

	/**
	 * Parse family record line
	 */
	private static parseFamilyLine(
		line: GedcomLine,
		family: GedcomFamily,
		context: string[]
	): void {
		// Update context for level 1 tags
		if (line.level === 1) {
			context.length = 0;
			context.push(line.tag);
		} else if (line.level === 2) {
			context.length = 1;
			context.push(line.tag);
		}

		switch (line.tag) {
			case 'HUSB':
				family.husbandRef = line.value.replace(/@/g, '');
				break;

			case 'WIFE':
				family.wifeRef = line.value.replace(/@/g, '');
				break;

			case 'CHIL':
				family.childRefs.push(line.value.replace(/@/g, ''));
				break;

			case 'DATE':
				if (context[0] === 'MARR') {
					family.marriageDate = line.value;
				}
				break;

			case 'PLAC':
				if (context[0] === 'MARR') {
					family.marriagePlace = line.value;
				}
				break;
		}
	}

	/**
	 * Link family relationships to individuals
	 */
	private static linkFamilies(data: GedcomData): void {
		for (const family of data.families.values()) {
			// Link parents to children
			for (const childRef of family.childRefs) {
				const child = data.individuals.get(childRef);
				if (child) {
					if (family.husbandRef) {
						child.fatherRef = family.husbandRef;
					}
					if (family.wifeRef) {
						child.motherRef = family.wifeRef;
					}
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
		}
	}

	/**
	 * Convert GEDCOM date to ISO format (YYYY-MM-DD)
	 */
	static gedcomDateToISO(gedcomDate: string): string | undefined {
		if (!gedcomDate) return undefined;

		// Remove qualifiers like ABT, BEF, AFT, etc.
		const cleaned = gedcomDate.replace(/^(ABT|BEF|AFT|CAL|EST)\s+/i, '').trim();

		// Try to parse common formats
		// Format: DD MMM YYYY (e.g., "15 MAR 1950")
		const match1 = cleaned.match(/^(\d{1,2})\s+([A-Z]{3})\s+(\d{4})$/i);
		if (match1) {
			const day = match1[1].padStart(2, '0');
			const month = this.monthToNumber(match1[2]);
			const year = match1[3];
			return `${year}-${month}-${day}`;
		}

		// Format: MMM YYYY (e.g., "MAR 1950")
		const match2 = cleaned.match(/^([A-Z]{3})\s+(\d{4})$/i);
		if (match2) {
			const month = this.monthToNumber(match2[1]);
			const year = match2[2];
			return `${year}-${month}-01`;
		}

		// Format: YYYY (e.g., "1950")
		const match3 = cleaned.match(/^(\d{4})$/);
		if (match3) {
			return `${match3[1]}-01-01`;
		}

		return undefined;
	}

	/**
	 * Convert month abbreviation to number
	 */
	private static monthToNumber(month: string): string {
		const months: Record<string, string> = {
			'JAN': '01', 'FEB': '02', 'MAR': '03', 'APR': '04',
			'MAY': '05', 'JUN': '06', 'JUL': '07', 'AUG': '08',
			'SEP': '09', 'OCT': '10', 'NOV': '11', 'DEC': '12'
		};
		return months[month.toUpperCase()] || '01';
	}
}
