/**
 * PDF Report Renderer
 *
 * Renders genealogical reports as professionally styled PDF documents.
 * Uses pdfmake with dynamic loading and standard PDF fonts.
 */

import { Notice } from 'obsidian';
// Use loose typing for pdfmake due to complex Content type requirements
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Content = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TDocumentDefinitions = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StyleDictionary = any;
import type {
	FamilyGroupSheetResult,
	IndividualSummaryResult,
	AhnentafelResult,
	GapsReportResult,
	RegisterReportResult,
	PedigreeChartResult,
	DescendantChartResult,
	ReportPerson
} from '../types/report-types';

/**
 * PDF generation options
 */
export interface PdfOptions {
	pageSize: 'A4' | 'LETTER';
	fontStyle: 'serif' | 'sans-serif';
	includeCoverPage: boolean;
}

/**
 * Default PDF options
 */
const DEFAULT_PDF_OPTIONS: PdfOptions = {
	pageSize: 'A4',
	fontStyle: 'serif',
	includeCoverPage: false
};

/**
 * Color palette for PDF styling
 */
const COLORS = {
	primaryText: '#333333',
	secondaryText: '#555555',
	tertiaryText: '#666666',
	mutedText: '#888888',
	lightMuted: '#999999',
	accentBar: '#5b5b5b',
	headerRow: '#e8e8e8',
	alternatingRow: '#f8f8f8',
	cardBackground: '#fafafa',
	borderLight: '#dddddd',
	borderCard: '#e0e0e0',
	separatorLine: '#cccccc'
};

/**
 * PDF Report Renderer service
 *
 * Lazily loads pdfmake to minimize bundle impact.
 */
export class PdfReportRenderer {
	private pdfMake: any = null;

	/**
	 * Ensure pdfmake is loaded (lazy loading)
	 */
	private async ensurePdfMake(): Promise<void> {
		if (this.pdfMake) return;

		new Notice('Preparing PDF export...');

		// Dynamic import - only loads when needed
		const pdfMakeModule = await import('pdfmake/build/pdfmake');
		this.pdfMake = pdfMakeModule.default || pdfMakeModule;

		// Load the virtual file system with embedded Roboto font
		const vfsFonts = await import('pdfmake/build/vfs_fonts');
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const vfsModule = vfsFonts as any;
		this.pdfMake.vfs = vfsModule.pdfMake?.vfs || vfsModule.default?.pdfMake?.vfs || vfsModule.vfs;

		// Use Roboto font (included in vfs_fonts.js)
		// Map our font names to Roboto variants
		this.pdfMake.fonts = {
			Roboto: {
				normal: 'Roboto-Regular.ttf',
				bold: 'Roboto-Medium.ttf',
				italics: 'Roboto-Italic.ttf',
				bolditalics: 'Roboto-MediumItalic.ttf'
			}
		};
	}

	/**
	 * Get the default font based on style preference
	 * Note: Currently using Roboto for all styles (bundled with pdfmake)
	 */
	private getDefaultFont(_fontStyle: 'serif' | 'sans-serif'): string {
		// Roboto is the only font bundled with pdfmake's vfs_fonts
		// Future: could add serif font option with custom font embedding
		return 'Roboto';
	}

	/**
	 * Get shared styles for all reports
	 */
	private getStyles(_fontStyle: 'serif' | 'sans-serif'): StyleDictionary {
		const headerFont = 'Roboto'; // Using Roboto (bundled with pdfmake)
		return {
			title: {
				fontSize: 22,
				bold: true,
				alignment: 'center',
				margin: [0, 0, 0, 8]
			},
			subtitle: {
				fontSize: 14,
				italics: true,
				alignment: 'center',
				color: '#444444',
				margin: [0, 0, 0, 20]
			},
			sectionHeader: {
				font: headerFont,
				fontSize: 11,
				bold: true,
				color: COLORS.primaryText,
				margin: [0, 18, 0, 8]
			},
			label: {
				font: headerFont,
				fontSize: 10,
				bold: true,
				color: COLORS.primaryText
			},
			value: {
				fontSize: 10
			},
			tableHeader: {
				font: headerFont,
				fontSize: 9,
				bold: true,
				fillColor: COLORS.headerRow
			},
			tableCell: {
				fontSize: 9
			},
			note: {
				fontSize: 9,
				italics: true,
				color: COLORS.tertiaryText
			},
			pageHeader: {
				font: headerFont,
				fontSize: 9,
				color: COLORS.tertiaryText
			},
			pageFooter: {
				font: headerFont,
				fontSize: 8,
				color: COLORS.lightMuted
			},
			monospace: {
				font: 'Roboto',  // No monospace font bundled; use Roboto
				fontSize: 9
			}
		};
	}

	/**
	 * Build a section header with accent bar
	 */
	private buildSectionHeader(title: string): Content {
		return {
			columns: [
				{
					canvas: [
						{
							type: 'rect',
							x: 0,
							y: 0,
							w: 3,
							h: 14,
							color: COLORS.accentBar
						}
					],
					width: 6
				},
				{
					text: title.toUpperCase(),
					style: 'sectionHeader',
					margin: [6, 0, 0, 0]
				}
			],
			margin: [0, 18, 0, 8]
		};
	}

	/**
	 * Build a key-value table (for vitals, etc.)
	 */
	private buildKeyValueTable(data: Array<{ label: string; value: string }>): Content {
		const filteredData = data.filter(item => item.value && item.value.trim() !== '');
		if (filteredData.length === 0) {
			return { text: 'No information recorded.', style: 'note', margin: [0, 0, 0, 10] };
		}

		return {
			table: {
				widths: [120, '*'],
				body: filteredData.map(item => [
					{ text: item.label, style: 'label' },
					{ text: item.value, style: 'value' }
				])
			},
			layout: 'noBorders',
			margin: [0, 0, 0, 10]
		};
	}

	/**
	 * Build a columnar data table with zebra striping
	 */
	private buildDataTable(
		headers: string[],
		rows: string[][],
		widths?: (string | number)[]
	): Content {
		if (rows.length === 0) {
			return { text: 'None recorded.', style: 'note', margin: [0, 0, 0, 10] };
		}

		const tableWidths = widths || headers.map(() => '*');

		return {
			table: {
				headerRows: 1,
				widths: tableWidths,
				body: [
					headers.map(h => ({ text: h, style: 'tableHeader' })),
					...rows.map((row, index) =>
						row.map(cell => ({
							text: cell,
							style: 'tableCell',
							fillColor: index % 2 === 1 ? COLORS.alternatingRow : undefined
						}))
					)
				]
			},
			layout: {
				hLineWidth: (i: number, node: any) => (i === 0 || i === 1 || i === node.table.body.length ? 0.5 : 0.25),
				vLineWidth: () => 0.25,
				hLineColor: (i: number) => (i === 1 ? '#666666' : COLORS.borderLight),
				vLineColor: () => COLORS.borderLight,
				paddingLeft: () => 6,
				paddingRight: () => 6,
				paddingTop: () => 5,
				paddingBottom: () => 5
			},
			margin: [0, 0, 0, 10]
		};
	}

	/**
	 * Build a relationship card (for marriages, etc.)
	 */
	private buildRelationshipCard(title: string, data: Array<{ label: string; value: string }>): Content {
		const filteredData = data.filter(item => item.value && item.value.trim() !== '');

		return {
			margin: [40, 15, 40, 15],
			table: {
				widths: ['*'],
				body: [[
					{
						stack: [
							{ text: '\u2767', alignment: 'center', fontSize: 14, color: COLORS.mutedText, margin: [0, 8, 0, 4] }, // Fleuron
							{ text: title.toUpperCase(), alignment: 'center', fontSize: 11, bold: true, color: COLORS.secondaryText, margin: [0, 0, 0, 8] },
							...filteredData.map(item => ({
								columns: [
									{ text: item.label + ':', width: 60, alignment: 'right', style: 'label', margin: [0, 0, 8, 2] },
									{ text: item.value, style: 'value', margin: [0, 0, 0, 2] }
								],
								margin: [20, 0, 20, 0]
							})),
							{ text: '', margin: [0, 0, 0, 8] }
						],
						fillColor: COLORS.cardBackground
					}
				]]
			},
			layout: {
				hLineWidth: () => 0.5,
				vLineWidth: () => 0.5,
				hLineColor: () => COLORS.borderCard,
				vLineColor: () => COLORS.borderCard
			}
		};
	}

	/**
	 * Strip wikilink brackets from text (e.g., [[Place Name]] -> Place Name)
	 */
	private stripWikilinks(text: string | undefined): string {
		if (!text) return '';
		return text.replace(/\[\[([^\]]+)\]\]/g, '$1');
	}

	/**
	 * Format a person's name for display
	 */
	private formatPersonName(person: ReportPerson): string {
		return person.name || 'Unknown';
	}

	/**
	 * Format a person's vital info (birth - death)
	 */
	private formatVitals(person: ReportPerson): string {
		const parts: string[] = [];
		if (person.birthDate) parts.push(`b. ${person.birthDate}`);
		if (person.deathDate) parts.push(`d. ${person.deathDate}`);
		return parts.join(', ') || '';
	}

	/**
	 * Create the document header
	 */
	private createHeader(reportTitle: string): (currentPage: number, pageCount: number) => Content {
		return (currentPage: number, pageCount: number): Content => ({
			columns: [
				{ text: reportTitle, style: 'pageHeader', alignment: 'left' },
				{ text: 'Canvas Roots', style: 'pageHeader', alignment: 'right' }
			],
			margin: [40, 20, 40, 0]
		});
	}

	/**
	 * Create the document footer
	 */
	private createFooter(): (currentPage: number, pageCount: number) => Content {
		const generatedDate = new Date().toLocaleDateString();
		return (currentPage: number, pageCount: number): Content => ({
			columns: [
				{ text: `Generated: ${generatedDate}`, style: 'pageFooter', alignment: 'left' },
				{ text: `Page ${currentPage} of ${pageCount}`, style: 'pageFooter', alignment: 'right' }
			],
			margin: [40, 10, 40, 0]
		});
	}

	/**
	 * Build a cover page for the report
	 */
	private buildCoverPage(reportTitle: string, subtitle?: string): Content[] {
		const generatedDate = new Date().toLocaleDateString();
		const content: Content[] = [];

		// Vertical spacer to center content
		content.push({ text: '', margin: [0, 150, 0, 0] });

		// Report title
		content.push({
			text: reportTitle,
			fontSize: 28,
			bold: true,
			alignment: 'center',
			color: COLORS.primaryText,
			margin: [0, 0, 0, 20]
		});

		// Subtitle (person name, etc.)
		if (subtitle) {
			content.push({
				text: subtitle,
				fontSize: 18,
				italics: true,
				alignment: 'center',
				color: COLORS.secondaryText,
				margin: [0, 0, 0, 30]
			});
		}

		// Decorative line (centered: 200pt line on ~515pt content width)
		content.push({
			canvas: [
				{
					type: 'line',
					x1: 157,
					y1: 0,
					x2: 357,
					y2: 0,
					lineWidth: 1,
					lineColor: COLORS.separatorLine
				}
			],
			margin: [0, 0, 0, 30]
		});

		// Generation info
		content.push({
			text: `Generated on ${generatedDate}`,
			fontSize: 11,
			alignment: 'center',
			color: COLORS.mutedText,
			margin: [0, 0, 0, 8]
		});

		content.push({
			text: 'Canvas Roots for Obsidian',
			fontSize: 10,
			alignment: 'center',
			color: COLORS.lightMuted,
			margin: [0, 0, 0, 0]
		});

		// Page break after cover
		content.push({ text: '', pageBreak: 'after' });

		return content;
	}

	/**
	 * Render Family Group Sheet to PDF
	 */
	async renderFamilyGroupSheet(
		result: FamilyGroupSheetResult,
		options: PdfOptions = DEFAULT_PDF_OPTIONS
	): Promise<void> {
		await this.ensurePdfMake();

		const defaultFont = this.getDefaultFont(options.fontStyle);
		const reportTitle = 'Family Group Sheet';
		const husbandName = result.primaryPerson.sex === 'male' ? result.primaryPerson.name : result.spouses[0]?.name || '';
		const wifeName = result.primaryPerson.sex === 'female' ? result.primaryPerson.name : result.spouses[0]?.name || '';
		const subtitle = `${husbandName} & ${wifeName}`;

		// Build content
		const content: Content[] = [];

		// Cover page (if enabled)
		if (options.includeCoverPage) {
			content.push(...this.buildCoverPage(reportTitle, subtitle));
		}

		// Title
		content.push({ text: reportTitle, style: 'title' });
		content.push({ text: subtitle, style: 'subtitle' });

		// Husband section
		const husband = result.primaryPerson.sex === 'male' ? result.primaryPerson : result.spouses[0];
		if (husband) {
			content.push(this.buildSectionHeader('Husband'));
			content.push(this.buildKeyValueTable([
				{ label: 'Name', value: husband.name },
				{ label: 'Birth date', value: husband.birthDate || '' },
				{ label: 'Birth place', value: this.stripWikilinks(husband.birthPlace) },
				{ label: 'Death date', value: husband.deathDate || '' },
				{ label: 'Death place', value: this.stripWikilinks(husband.deathPlace) },
				{ label: 'Occupation', value: husband.occupation || '' }
			]));
		}

		// Wife section
		const wife = result.primaryPerson.sex === 'female' ? result.primaryPerson : result.spouses[0];
		if (wife) {
			content.push(this.buildSectionHeader('Wife'));
			content.push(this.buildKeyValueTable([
				{ label: 'Name', value: wife.name },
				{ label: 'Birth date', value: wife.birthDate || '' },
				{ label: 'Birth place', value: this.stripWikilinks(wife.birthPlace) },
				{ label: 'Death date', value: wife.deathDate || '' },
				{ label: 'Death place', value: this.stripWikilinks(wife.deathPlace) },
				{ label: 'Occupation', value: wife.occupation || '' }
			]));
		}

		// Marriage section (placeholder - would need marriage data from result)
		// TODO: Add marriage data to FamilyGroupSheetResult if available

		// Children section
		if (result.children.length > 0) {
			content.push(this.buildSectionHeader('Children'));
			content.push(this.buildDataTable(
				['#', 'Name', 'Sex', 'Birth', 'Death'],
				result.children.map((child, index) => [
					(index + 1).toString(),
					child.name,
					child.sex === 'male' ? 'M' : child.sex === 'female' ? 'F' : '?',
					child.birthDate || '',
					child.deathDate || ''
				]),
				[25, '*', 30, 80, 80]
			));
		}

		// Create document definition
		const docDefinition: TDocumentDefinitions = {
			pageSize: options.pageSize,
			pageMargins: [40, 60, 40, 60],
			defaultStyle: {
				font: defaultFont,
				fontSize: 10
			},
			header: this.createHeader(reportTitle),
			footer: this.createFooter(),
			content,
			styles: this.getStyles(options.fontStyle)
		};

		// Generate and download PDF
		const filename = `Family-Group-Sheet-${husbandName.replace(/\s+/g, '-')}-${wifeName.replace(/\s+/g, '-')}.pdf`;
		this.pdfMake.createPdf(docDefinition).download(filename);

		new Notice('PDF downloaded');
	}

	/**
	 * Render Ahnentafel Report to PDF
	 */
	async renderAhnentafel(
		result: AhnentafelResult,
		options: PdfOptions = DEFAULT_PDF_OPTIONS
	): Promise<void> {
		await this.ensurePdfMake();

		const defaultFont = this.getDefaultFont(options.fontStyle);
		const reportTitle = 'Ahnentafel Report';
		const subtitle = `Ancestors of ${result.rootPerson.name}`;

		const content: Content[] = [];

		// Cover page (if enabled)
		if (options.includeCoverPage) {
			content.push(...this.buildCoverPage(reportTitle, subtitle));
		}

		// Title
		content.push({ text: reportTitle, style: 'title' });
		content.push({ text: subtitle, style: 'subtitle' });

		// Group ancestors by generation
		const generations = new Map<number, Array<{ sosa: number; person: ReportPerson }>>();
		result.ancestors.forEach((person, sosa) => {
			const gen = Math.floor(Math.log2(sosa)) + 1;
			if (!generations.has(gen)) {
				generations.set(gen, []);
			}
			generations.get(gen)!.push({ sosa, person });
		});

		// Render each generation
		const sortedGenerations = Array.from(generations.keys()).sort((a, b) => a - b);
		for (const gen of sortedGenerations) {
			const genLabel = gen === 1 ? 'Generation 1 (Self)' : `Generation ${gen}`;
			content.push(this.buildSectionHeader(genLabel));

			const ancestors = generations.get(gen)!.sort((a, b) => a.sosa - b.sosa);
			for (const { sosa, person } of ancestors) {
				const vitals = this.formatVitals(person);
				content.push({
					text: [
						{ text: `${sosa}. `, bold: true },
						{ text: person.name },
						vitals ? { text: ` (${vitals})`, color: COLORS.tertiaryText } : {}
					],
					margin: [0, 2, 0, 2]
				});
			}
		}

		// Summary
		content.push(this.buildSectionHeader('Summary'));
		content.push(this.buildKeyValueTable([
			{ label: 'Total ancestors', value: result.ancestors.size.toString() },
			{ label: 'Generations', value: (result.stats.generationsCount || sortedGenerations.length).toString() }
		]));

		const docDefinition: TDocumentDefinitions = {
			pageSize: options.pageSize,
			pageMargins: [40, 60, 40, 60],
			defaultStyle: {
				font: defaultFont,
				fontSize: 10
			},
			header: this.createHeader(reportTitle),
			footer: this.createFooter(),
			content,
			styles: this.getStyles(options.fontStyle)
		};

		const filename = `Ahnentafel-${result.rootPerson.name.replace(/\s+/g, '-')}.pdf`;
		this.pdfMake.createPdf(docDefinition).download(filename);

		new Notice('PDF downloaded');
	}

	/**
	 * Render Individual Summary to PDF
	 */
	async renderIndividualSummary(
		result: IndividualSummaryResult,
		options: PdfOptions = DEFAULT_PDF_OPTIONS
	): Promise<void> {
		await this.ensurePdfMake();

		const defaultFont = this.getDefaultFont(options.fontStyle);
		const reportTitle = 'Individual Summary';
		const subtitle = result.person.name;

		const content: Content[] = [];

		// Cover page (if enabled)
		if (options.includeCoverPage) {
			content.push(...this.buildCoverPage(reportTitle, subtitle));
		}

		// Title
		content.push({ text: reportTitle, style: 'title' });
		content.push({ text: subtitle, style: 'subtitle' });

		// Vital Statistics
		content.push(this.buildSectionHeader('Vital Statistics'));
		content.push(this.buildKeyValueTable([
			{ label: 'Name', value: result.person.name },
			{ label: 'Sex', value: result.person.sex || 'Unknown' },
			{ label: 'Birth date', value: result.person.birthDate || '' },
			{ label: 'Birth place', value: this.stripWikilinks(result.person.birthPlace) },
			{ label: 'Death date', value: result.person.deathDate || '' },
			{ label: 'Death place', value: this.stripWikilinks(result.person.deathPlace) },
			{ label: 'Occupation', value: result.person.occupation || '' }
		]));

		// Events
		if (result.events.length > 0) {
			content.push(this.buildSectionHeader('Life Events'));
			content.push(this.buildDataTable(
				['Event', 'Date', 'Place', 'Notes'],
				result.events.map(event => [
					event.type,
					event.date || '',
					this.stripWikilinks(event.place),
					event.description || ''
				]),
				[80, 80, '*', '*']
			));
		}

		const docDefinition: TDocumentDefinitions = {
			pageSize: options.pageSize,
			pageMargins: [40, 60, 40, 60],
			defaultStyle: {
				font: defaultFont,
				fontSize: 10
			},
			header: this.createHeader(reportTitle),
			footer: this.createFooter(),
			content,
			styles: this.getStyles(options.fontStyle)
		};

		const filename = `Individual-Summary-${result.person.name.replace(/\s+/g, '-')}.pdf`;
		this.pdfMake.createPdf(docDefinition).download(filename);

		new Notice('PDF downloaded');
	}

	/**
	 * Render Gaps Report to PDF
	 */
	async renderGapsReport(
		result: GapsReportResult,
		options: PdfOptions = DEFAULT_PDF_OPTIONS
	): Promise<void> {
		await this.ensurePdfMake();

		const defaultFont = this.getDefaultFont(options.fontStyle);
		const reportTitle = 'Data Quality Report';
		const subtitle = 'Research Opportunities & Missing Data';

		const content: Content[] = [];

		// Cover page (if enabled)
		if (options.includeCoverPage) {
			content.push(...this.buildCoverPage(reportTitle, subtitle));
		}

		// Title
		content.push({ text: reportTitle, style: 'title' });
		content.push({ text: subtitle, style: 'subtitle' });

		// Summary
		content.push(this.buildSectionHeader('Summary'));
		content.push(this.buildDataTable(
			['Category', 'Count'],
			[
				['Total people analyzed', result.summary.totalPeople.toString()],
				['Missing birth dates', result.summary.missingBirthDate.toString()],
				['Missing death dates', result.summary.missingDeathDate.toString()],
				['Missing parents', result.summary.missingParents.toString()],
				['Without sources', result.summary.unsourced.toString()]
			],
			['*', 80]
		));

		// Missing birth dates
		if (result.missingBirthDates.length > 0) {
			content.push(this.buildSectionHeader('Missing Birth Dates'));
			content.push(this.buildDataTable(
				['Name', 'Death Date'],
				result.missingBirthDates.map(p => [p.name, p.deathDate || '']),
				['*', 100]
			));
		}

		// Missing death dates
		if (result.missingDeathDates.length > 0) {
			content.push(this.buildSectionHeader('Missing Death Dates'));
			content.push(this.buildDataTable(
				['Name', 'Birth Date'],
				result.missingDeathDates.map(p => [p.name, p.birthDate || '']),
				['*', 100]
			));
		}

		// Missing parents
		if (result.missingParents.length > 0) {
			content.push(this.buildSectionHeader('Missing Parents'));
			content.push(this.buildDataTable(
				['Name', 'Birth', 'Death'],
				result.missingParents.map(p => [p.name, p.birthDate || '', p.deathDate || '']),
				['*', 80, 80]
			));
		}

		// Unsourced
		if (result.unsourcedPeople.length > 0) {
			content.push(this.buildSectionHeader('Without Source Citations'));
			content.push(this.buildDataTable(
				['Name', 'Birth', 'Death'],
				result.unsourcedPeople.map(p => [p.name, p.birthDate || '', p.deathDate || '']),
				['*', 80, 80]
			));
		}

		const docDefinition: TDocumentDefinitions = {
			pageSize: options.pageSize,
			pageMargins: [40, 60, 40, 60],
			defaultStyle: {
				font: defaultFont,
				fontSize: 10
			},
			header: this.createHeader(reportTitle),
			footer: this.createFooter(),
			content,
			styles: this.getStyles(options.fontStyle)
		};

		const filename = `Gaps-Report-${new Date().toISOString().split('T')[0]}.pdf`;
		this.pdfMake.createPdf(docDefinition).download(filename);

		new Notice('PDF downloaded');
	}

	/**
	 * Render Register Report to PDF
	 */
	async renderRegisterReport(
		result: RegisterReportResult,
		options: PdfOptions = DEFAULT_PDF_OPTIONS
	): Promise<void> {
		await this.ensurePdfMake();

		const defaultFont = this.getDefaultFont(options.fontStyle);
		const reportTitle = 'Register Report';
		const subtitle = `Descendants of ${result.rootPerson.name}`;

		const content: Content[] = [];

		// Cover page (if enabled)
		if (options.includeCoverPage) {
			content.push(...this.buildCoverPage(reportTitle, subtitle));
		}

		// Title
		content.push({ text: reportTitle, style: 'title' });
		content.push({ text: subtitle, style: 'subtitle' });

		// Entries
		for (const entry of result.entries) {
			// Person header
			content.push({
				text: [
					{ text: `${entry.registerNumber}. `, bold: true },
					{ text: entry.person.name, bold: true }
				],
				margin: [0, 15, 0, 5],
				fontSize: 11
			});

			// Vitals
			const vitalsData: Array<{ label: string; value: string }> = [];
			if (entry.person.birthDate || entry.person.birthPlace) {
				vitalsData.push({
					label: 'Born',
					value: [entry.person.birthDate, this.stripWikilinks(entry.person.birthPlace)].filter(Boolean).join(', ')
				});
			}
			if (entry.person.deathDate || entry.person.deathPlace) {
				vitalsData.push({
					label: 'Died',
					value: [entry.person.deathDate, this.stripWikilinks(entry.person.deathPlace)].filter(Boolean).join(', ')
				});
			}
			if (vitalsData.length > 0) {
				content.push(this.buildKeyValueTable(vitalsData));
			}

			// Spouses
			if (entry.spouses.length > 0) {
				for (const spouse of entry.spouses) {
					content.push({
						text: [
							{ text: 'Married: ', italics: true },
							{ text: spouse.name }
						],
						margin: [20, 2, 0, 2]
					});
				}
			}

			// Children
			if (entry.children.length > 0) {
				content.push({ text: 'Children:', italics: true, margin: [20, 5, 0, 2] });
				entry.children.forEach((child, index) => {
					const romanNumeral = this.toRomanNumeral(index + 1);
					const continuesLine = child.registerNumber ? ` (see #${child.registerNumber})` : '';
					content.push({
						text: `${romanNumeral}. ${child.person.name}${continuesLine}`,
						margin: [40, 1, 0, 1]
					});
				});
			}
		}

		const docDefinition: TDocumentDefinitions = {
			pageSize: options.pageSize,
			pageMargins: [40, 60, 40, 60],
			defaultStyle: {
				font: defaultFont,
				fontSize: 10
			},
			header: this.createHeader(reportTitle),
			footer: this.createFooter(),
			content,
			styles: this.getStyles(options.fontStyle)
		};

		const filename = `Register-Report-${result.rootPerson.name.replace(/\s+/g, '-')}.pdf`;
		this.pdfMake.createPdf(docDefinition).download(filename);

		new Notice('PDF downloaded');
	}

	/**
	 * Render Pedigree Chart to PDF
	 */
	async renderPedigreeChart(
		result: PedigreeChartResult,
		options: PdfOptions = DEFAULT_PDF_OPTIONS
	): Promise<void> {
		await this.ensurePdfMake();

		const reportTitle = 'Pedigree Chart';
		const subtitle = `Ancestors of ${result.rootPerson.name}`;

		const content: Content[] = [];

		// Cover page (if enabled)
		if (options.includeCoverPage) {
			content.push(...this.buildCoverPage(reportTitle, subtitle));
		}

		// Title
		content.push({ text: reportTitle, style: 'title' });
		content.push({ text: subtitle, style: 'subtitle' });

		// ASCII tree in monospace
		content.push(this.buildSectionHeader('Ancestor Tree'));
		content.push({
			text: result.treeContent,
			style: 'monospace',
			preserveLeadingSpaces: true,
			margin: [0, 0, 0, 20]
		});

		const docDefinition: TDocumentDefinitions = {
			pageSize: options.pageSize,
			pageMargins: [40, 60, 40, 60],
			defaultStyle: {
				font: this.getDefaultFont(options.fontStyle),
				fontSize: 10
			},
			header: this.createHeader(reportTitle),
			footer: this.createFooter(),
			content,
			styles: this.getStyles(options.fontStyle)
		};

		const filename = `Pedigree-Chart-${result.rootPerson.name.replace(/\s+/g, '-')}.pdf`;
		this.pdfMake.createPdf(docDefinition).download(filename);

		new Notice('PDF downloaded');
	}

	/**
	 * Render Descendant Chart to PDF
	 */
	async renderDescendantChart(
		result: DescendantChartResult,
		options: PdfOptions = DEFAULT_PDF_OPTIONS
	): Promise<void> {
		await this.ensurePdfMake();

		const defaultFont = this.getDefaultFont(options.fontStyle);
		const reportTitle = 'Descendant Chart';
		const subtitle = `Descendants of ${result.rootPerson.name}`;

		const content: Content[] = [];

		// Cover page (if enabled)
		if (options.includeCoverPage) {
			content.push(...this.buildCoverPage(reportTitle, subtitle));
		}

		// Title
		content.push({ text: reportTitle, style: 'title' });
		content.push({ text: subtitle, style: 'subtitle' });

		// Tree structure
		content.push(this.buildSectionHeader('Descendant Tree'));

		for (const entry of result.entries) {
			const indent = entry.level * 20;
			const vitals = this.formatVitals(entry.person);

			content.push({
				text: [
					{ text: entry.person.name },
					vitals ? { text: ` (${vitals})`, color: COLORS.tertiaryText } : {}
				],
				margin: [indent, 2, 0, 2]
			});

			// Spouses
			for (const spouse of entry.spouses) {
				content.push({
					text: [
						{ text: 'm. ', italics: true },
						{ text: spouse.name }
					],
					margin: [indent + 15, 0, 0, 2],
					color: COLORS.secondaryText
				});
			}
		}

		const docDefinition: TDocumentDefinitions = {
			pageSize: options.pageSize,
			pageMargins: [40, 60, 40, 60],
			defaultStyle: {
				font: defaultFont,
				fontSize: 10
			},
			header: this.createHeader(reportTitle),
			footer: this.createFooter(),
			content,
			styles: this.getStyles(options.fontStyle)
		};

		const filename = `Descendant-Chart-${result.rootPerson.name.replace(/\s+/g, '-')}.pdf`;
		this.pdfMake.createPdf(docDefinition).download(filename);

		new Notice('PDF downloaded');
	}

	/**
	 * Convert number to Roman numeral (for children lists)
	 */
	private toRomanNumeral(num: number): string {
		const romanNumerals: Array<[number, string]> = [
			[10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']
		];
		let result = '';
		for (const [value, numeral] of romanNumerals) {
			while (num >= value) {
				result += numeral;
				num -= value;
			}
		}
		return result;
	}
}
