/**
 * PDF Report Renderer
 *
 * Renders genealogical reports as professionally styled PDF documents.
 * Uses pdfmake with dynamic loading and standard PDF fonts.
 */

import { Notice } from 'obsidian';
/**
 * Minimal type definitions for pdfmake to avoid strict type checking issues.
 * pdfmake's type definitions are complex and don't match all our content structures.
 * Using looser types here allows flexibility while still providing basic type safety.
 */

/** Basic content type for pdfmake - allows any valid content structure */
type Content = Record<string, unknown> | string | Content[];

/** Document definition for pdfmake */
interface TDocumentDefinitions {
	pageSize: string | { width: number; height: number };
	pageOrientation?: 'portrait' | 'landscape';
	pageMargins: [number, number, number, number];
	defaultStyle: Record<string, unknown>;
	header?: (currentPage: number, pageCount: number) => Content;
	footer?: (currentPage: number, pageCount: number) => Content;
	content: Content;
	styles: StyleDictionary;
}

/** Style dictionary for pdfmake */
interface StyleDictionary {
	[styleName: string]: Record<string, unknown>;
}

/** Font dictionary for pdfmake */
interface TFontDictionary {
	[fontName: string]: {
		normal?: string;
		bold?: string;
		italics?: string;
		bolditalics?: string;
	};
}

/** Table node type for layout callbacks */
interface ContentTable {
	table: {
		body: unknown[][];
		widths?: unknown[];
		headerRows?: number;
	};
}

/** Created PDF interface with download method */
interface TCreatedPdf {
	download(filename: string): void;
	getBlob(cb: (blob: Blob) => void): void;
}

/**
 * Type for the dynamically loaded pdfmake module instance.
 */
interface PdfMakeInstance {
	createPdf(docDefinition: TDocumentDefinitions): TCreatedPdf;
	vfs: { [file: string]: string };
	fonts: TFontDictionary;
}

/**
 * Type for the vfs_fonts module with multiple possible export shapes.
 * Different bundler configurations export the vfs differently.
 */
interface VfsFontsModule {
	pdfMake?: { vfs: { [file: string]: string } };
	default?: { pdfMake?: { vfs: { [file: string]: string } } };
	vfs?: { [file: string]: string };
}
import type {
	FamilyGroupSheetResult,
	IndividualSummaryResult,
	AhnentafelResult,
	GapsReportResult,
	RegisterReportResult,
	PedigreeChartResult,
	DescendantChartResult,
	SourceSummaryResult,
	TimelineReportResult,
	PlaceSummaryResult,
	MediaInventoryResult,
	UniverseOverviewResult,
	CollectionOverviewResult,
	ReportPerson
} from '../types/report-types';
import type {
	VisualTreeLayout,
	VisualTreeOptions
} from '../../trees/types/visual-tree-types';
import { VisualTreeSvgRenderer } from '../../trees/services/visual-tree-svg-renderer';

/**
 * PDF generation options
 */
export interface PdfOptions {
	pageSize: 'A4' | 'LETTER';
	fontStyle: 'serif' | 'sans-serif';
	includeCoverPage: boolean;
	/** Logo/crest image as base64 data URL (displayed on cover page) */
	logoDataUrl?: string;
	/** Custom title to override the default report type name */
	customTitle?: string;
	/** Where to apply custom title: 'cover', 'headers', or 'both' */
	customTitleScope?: 'cover' | 'headers' | 'both';
	/** Custom subtitle to override the auto-generated subject line (cover page only) */
	customSubtitle?: string;
	/** Additional notes/preface text for cover page (supports multiple paragraphs) */
	coverNotes?: string;
	/** Date format preference: 'mdy' (Month-Day-Year), 'dmy' (Day-Month-Year), 'ymd' (Year-Month-Day) */
	dateFormat?: 'mdy' | 'dmy' | 'ymd';
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
	private _pdfMake: PdfMakeInstance | null = null;

	/**
	 * Get the pdfmake instance. Must call ensurePdfMake() first.
	 * @throws Error if pdfmake is not initialized
	 */
	private get pdfMake(): PdfMakeInstance {
		if (!this._pdfMake) {
			throw new Error('pdfmake not initialized. Call ensurePdfMake() first.');
		}
		return this._pdfMake;
	}

	/**
	 * Ensure pdfmake is loaded (lazy loading)
	 */
	private async ensurePdfMake(): Promise<void> {
		if (this._pdfMake) return;

		new Notice('Preparing PDF export...');

		// Load our bundled font VFS (includes Roboto + Roboto Mono)
		const { vfsFonts } = await import('../fonts/vfs_fonts_all');

		// Dynamic import - only loads when needed
		const pdfMakeModule = await import('pdfmake/build/pdfmake');
		this._pdfMake = (pdfMakeModule.default ?? pdfMakeModule) as unknown as PdfMakeInstance;

		// Set the VFS with all fonts
		this._pdfMake.vfs = vfsFonts;

		// Configure fonts: Roboto for general text, DejaVu Sans Mono for monospace
		this._pdfMake.fonts = {
			Roboto: {
				normal: 'Roboto-Regular.ttf',
				bold: 'Roboto-Medium.ttf',
				italics: 'Roboto-Italic.ttf',
				bolditalics: 'Roboto-MediumItalic.ttf'
			},
			DejaVuSansMono: {
				normal: 'DejaVuSansMono.ttf',
				bold: 'DejaVuSansMono.ttf',
				italics: 'DejaVuSansMono-Oblique.ttf',
				bolditalics: 'DejaVuSansMono-Oblique.ttf'
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
				font: 'DejaVuSansMono',  // Comprehensive Unicode support including box-drawing characters
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
				hLineWidth: (i: number, node: ContentTable) => (i === 0 || i === 1 || i === node.table.body.length ? 0.5 : 0.25),
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
	 * Format a date according to the specified format preference
	 */
	private formatDate(date: Date, format: 'mdy' | 'dmy' | 'ymd' = 'mdy'): string {
		const day = date.getDate();
		const month = date.getMonth() + 1;
		const year = date.getFullYear();

		switch (format) {
			case 'dmy':
				return `${day}/${month}/${year}`;
			case 'ymd':
				return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
			case 'mdy':
			default:
				return `${month}/${day}/${year}`;
		}
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
	private createFooter(dateFormat?: 'mdy' | 'dmy' | 'ymd'): (currentPage: number, pageCount: number) => Content {
		const generatedDate = this.formatDate(new Date(), dateFormat || 'mdy');
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
	private buildCoverPage(
		reportTitle: string,
		subtitle?: string,
		logoDataUrl?: string,
		coverNotes?: string,
		dateFormat?: 'mdy' | 'dmy' | 'ymd'
	): Content[] {
		const generatedDate = this.formatDate(new Date(), dateFormat || 'mdy');
		const content: Content[] = [];

		// Logo/crest at top (if provided)
		if (logoDataUrl) {
			content.push({ text: '', margin: [0, 60, 0, 0] });
			content.push({
				image: logoDataUrl,
				width: 100,
				alignment: 'center',
				margin: [0, 0, 0, 40]
			});
			// Less vertical spacer when logo is present
			content.push({ text: '', margin: [0, 30, 0, 0] });
		} else {
			// Vertical spacer to center content (no logo)
			content.push({ text: '', margin: [0, 150, 0, 0] });
		}

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

		// Cover notes/preface (if provided)
		if (coverNotes && coverNotes.trim()) {
			// Split by double newlines for paragraphs, or single newlines
			const paragraphs = coverNotes.split(/\n\n+/).map(p => p.trim()).filter(p => p);
			for (const paragraph of paragraphs) {
				content.push({
					text: paragraph,
					fontSize: 11,
					italics: true,
					alignment: 'center',
					color: COLORS.secondaryText,
					margin: [40, 0, 40, 12]
				});
			}
			// Add spacing after notes
			content.push({ text: '', margin: [0, 10, 0, 0] });
		}

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
		const defaultTitle = 'Family Group Sheet';
		const husbandName = result.primaryPerson.sex === 'male' ? result.primaryPerson.name : result.spouses[0]?.name || '';
		const wifeName = result.primaryPerson.sex === 'female' ? result.primaryPerson.name : result.spouses[0]?.name || '';
		const defaultSubtitle = `${husbandName} & ${wifeName}`;

		// Apply custom title based on scope
		const scope = options.customTitleScope || 'both';
		const coverTitle = (scope === 'cover' || scope === 'both') ? (options.customTitle || defaultTitle) : defaultTitle;
		const headerTitle = (scope === 'headers' || scope === 'both') ? (options.customTitle || defaultTitle) : defaultTitle;
		const subtitle = options.customSubtitle || defaultSubtitle;

		// Build content
		const content: Content[] = [];

		// Cover page (if enabled)
		if (options.includeCoverPage) {
			content.push(...this.buildCoverPage(coverTitle, subtitle, options.logoDataUrl, options.coverNotes, options.dateFormat));
		}

		// Title (uses cover title for consistency with cover page)
		content.push({ text: coverTitle, style: 'title' });
		content.push({ text: subtitle, style: 'subtitle' });

		// Husband section
		const husband = result.primaryPerson.sex === 'male' ? result.primaryPerson : result.spouses[0];
		if (husband) {
			content.push(this.buildSectionHeader('Husband'));
			content.push(this.buildKeyValueTable([
				{ label: 'Name', value: husband.name },
				{ label: 'Pronouns', value: husband.pronouns || '' },
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
				{ label: 'Pronouns', value: wife.pronouns || '' },
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
			header: this.createHeader(headerTitle),
			footer: this.createFooter(options.dateFormat),
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
		const defaultTitle = 'Ahnentafel Report';
		const defaultSubtitle = `Ancestors of ${result.rootPerson.name}`;

		// Apply custom title based on scope
		const scope = options.customTitleScope || 'both';
		const coverTitle = (scope === 'cover' || scope === 'both') ? (options.customTitle || defaultTitle) : defaultTitle;
		const headerTitle = (scope === 'headers' || scope === 'both') ? (options.customTitle || defaultTitle) : defaultTitle;
		const subtitle = options.customSubtitle || defaultSubtitle;

		const content: Content[] = [];

		// Cover page (if enabled)
		if (options.includeCoverPage) {
			content.push(...this.buildCoverPage(coverTitle, subtitle, options.logoDataUrl, options.coverNotes, options.dateFormat));
		}

		// Title
		content.push({ text: coverTitle, style: 'title' });
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
			header: this.createHeader(headerTitle),
			footer: this.createFooter(options.dateFormat),
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
		const defaultTitle = 'Individual Summary';
		const defaultSubtitle = result.person.name;

		// Apply custom title based on scope
		const scope = options.customTitleScope || 'both';
		const coverTitle = (scope === 'cover' || scope === 'both') ? (options.customTitle || defaultTitle) : defaultTitle;
		const headerTitle = (scope === 'headers' || scope === 'both') ? (options.customTitle || defaultTitle) : defaultTitle;
		const subtitle = options.customSubtitle || defaultSubtitle;

		const content: Content[] = [];

		// Cover page (if enabled)
		if (options.includeCoverPage) {
			content.push(...this.buildCoverPage(coverTitle, subtitle, options.logoDataUrl, options.coverNotes, options.dateFormat));
		}

		// Title
		content.push({ text: coverTitle, style: 'title' });
		content.push({ text: subtitle, style: 'subtitle' });

		// Vital Statistics
		content.push(this.buildSectionHeader('Vital Statistics'));
		content.push(this.buildKeyValueTable([
			{ label: 'Name', value: result.person.name },
			{ label: 'Sex', value: result.person.sex || 'Unknown' },
			{ label: 'Pronouns', value: result.person.pronouns || '' },
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
			header: this.createHeader(headerTitle),
			footer: this.createFooter(options.dateFormat),
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
		const defaultTitle = 'Data Quality Report';
		const defaultSubtitle = 'Research Opportunities & Missing Data';

		// Apply custom title based on scope
		const scope = options.customTitleScope || 'both';
		const coverTitle = (scope === 'cover' || scope === 'both') ? (options.customTitle || defaultTitle) : defaultTitle;
		const headerTitle = (scope === 'headers' || scope === 'both') ? (options.customTitle || defaultTitle) : defaultTitle;
		const subtitle = options.customSubtitle || defaultSubtitle;

		const content: Content[] = [];

		// Cover page (if enabled)
		if (options.includeCoverPage) {
			content.push(...this.buildCoverPage(coverTitle, subtitle, options.logoDataUrl, options.coverNotes, options.dateFormat));
		}

		// Title
		content.push({ text: coverTitle, style: 'title' });
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
			header: this.createHeader(headerTitle),
			footer: this.createFooter(options.dateFormat),
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
		const defaultTitle = 'Register Report';
		const defaultSubtitle = `Descendants of ${result.rootPerson.name}`;

		// Apply custom title based on scope
		const scope = options.customTitleScope || 'both';
		const coverTitle = (scope === 'cover' || scope === 'both') ? (options.customTitle || defaultTitle) : defaultTitle;
		const headerTitle = (scope === 'headers' || scope === 'both') ? (options.customTitle || defaultTitle) : defaultTitle;
		const subtitle = options.customSubtitle || defaultSubtitle;

		const content: Content[] = [];

		// Cover page (if enabled)
		if (options.includeCoverPage) {
			content.push(...this.buildCoverPage(coverTitle, subtitle, options.logoDataUrl, options.coverNotes, options.dateFormat));
		}

		// Title
		content.push({ text: coverTitle, style: 'title' });
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
			header: this.createHeader(headerTitle),
			footer: this.createFooter(options.dateFormat),
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

		const defaultTitle = 'Pedigree Chart';
		const defaultSubtitle = `Ancestors of ${result.rootPerson.name}`;

		// Apply custom title based on scope
		const scope = options.customTitleScope || 'both';
		const coverTitle = (scope === 'cover' || scope === 'both') ? (options.customTitle || defaultTitle) : defaultTitle;
		const headerTitle = (scope === 'headers' || scope === 'both') ? (options.customTitle || defaultTitle) : defaultTitle;
		const subtitle = options.customSubtitle || defaultSubtitle;

		const content: Content[] = [];

		// Cover page (if enabled)
		if (options.includeCoverPage) {
			content.push(...this.buildCoverPage(coverTitle, subtitle, options.logoDataUrl, options.coverNotes, options.dateFormat));
		}

		// Title
		content.push({ text: coverTitle, style: 'title' });
		content.push({ text: subtitle, style: 'subtitle' });

		// Tree visualization with Unicode box-drawing characters
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
			header: this.createHeader(headerTitle),
			footer: this.createFooter(options.dateFormat),
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
		const defaultTitle = 'Descendant Chart';
		const defaultSubtitle = `Descendants of ${result.rootPerson.name}`;

		// Apply custom title based on scope
		const scope = options.customTitleScope || 'both';
		const coverTitle = (scope === 'cover' || scope === 'both') ? (options.customTitle || defaultTitle) : defaultTitle;
		const headerTitle = (scope === 'headers' || scope === 'both') ? (options.customTitle || defaultTitle) : defaultTitle;
		const subtitle = options.customSubtitle || defaultSubtitle;

		const content: Content[] = [];

		// Cover page (if enabled)
		if (options.includeCoverPage) {
			content.push(...this.buildCoverPage(coverTitle, subtitle, options.logoDataUrl, options.coverNotes, options.dateFormat));
		}

		// Title
		content.push({ text: coverTitle, style: 'title' });
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
			header: this.createHeader(headerTitle),
			footer: this.createFooter(options.dateFormat),
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

	/**
	 * Render Source Summary to PDF
	 */
	async renderSourceSummary(
		result: SourceSummaryResult,
		options: PdfOptions = DEFAULT_PDF_OPTIONS
	): Promise<void> {
		await this.ensurePdfMake();

		const defaultFont = this.getDefaultFont(options.fontStyle);
		const defaultTitle = 'Source Summary';
		const defaultSubtitle = result.person.name;

		// Apply custom title based on scope
		const scope = options.customTitleScope || 'both';
		const coverTitle = (scope === 'cover' || scope === 'both') ? (options.customTitle || defaultTitle) : defaultTitle;
		const headerTitle = (scope === 'headers' || scope === 'both') ? (options.customTitle || defaultTitle) : defaultTitle;
		const subtitle = options.customSubtitle || defaultSubtitle;

		const content: Content[] = [];

		// Cover page (if enabled)
		if (options.includeCoverPage) {
			content.push(...this.buildCoverPage(coverTitle, subtitle, options.logoDataUrl, options.coverNotes, options.dateFormat));
		}

		// Title
		content.push({ text: coverTitle, style: 'title' });
		content.push({ text: subtitle, style: 'subtitle' });

		// Summary
		content.push(this.buildSectionHeader('Summary'));
		content.push(this.buildKeyValueTable([
			{ label: 'Total sources', value: result.summary.totalSources.toString() },
			{ label: 'Primary sources', value: result.summary.primaryCount.toString() },
			{ label: 'Secondary sources', value: result.summary.secondaryCount.toString() },
			{ label: 'Derivative sources', value: result.summary.derivativeCount.toString() },
			{ label: 'Unsourced facts', value: result.summary.unsourcedFactCount.toString() }
		]));

		// Sources by fact type
		const factTypes = Object.keys(result.sourcesByFactType);
		if (factTypes.length > 0) {
			content.push(this.buildSectionHeader('Sources by Fact'));

			for (const factType of factTypes) {
				const entries = result.sourcesByFactType[factType];
				content.push({
					text: factType,
					bold: true,
					margin: [0, 10, 0, 5],
					fontSize: 10
				});
				content.push(this.buildDataTable(
					['Source', 'Type', 'Quality'],
					entries.map(e => [e.title, e.sourceType || '', e.quality || '']),
					['*', 100, 80]
				));
			}
		}

		// Unsourced facts (gaps)
		if (result.unsourcedFacts.length > 0) {
			content.push(this.buildSectionHeader('Research Gaps'));
			content.push({
				text: 'The following facts have no source citations:',
				style: 'note',
				margin: [0, 0, 0, 8]
			});
			content.push({
				ul: result.unsourcedFacts,
				margin: [20, 0, 0, 10]
			});
		}

		// Repository summary
		if (result.repositories.length > 0) {
			content.push(this.buildSectionHeader('Repositories'));
			content.push(this.buildDataTable(
				['Repository', 'Sources'],
				result.repositories.map(r => [r.name, r.sourceCount.toString()]),
				['*', 80]
			));
		}

		const docDefinition: TDocumentDefinitions = {
			pageSize: options.pageSize,
			pageMargins: [40, 60, 40, 60],
			defaultStyle: {
				font: defaultFont,
				fontSize: 10
			},
			header: this.createHeader(headerTitle),
			footer: this.createFooter(options.dateFormat),
			content,
			styles: this.getStyles(options.fontStyle)
		};

		const filename = `Source-Summary-${result.person.name.replace(/\s+/g, '-')}.pdf`;
		this.pdfMake.createPdf(docDefinition).download(filename);

		new Notice('PDF downloaded');
	}

	/**
	 * Render Timeline Report to PDF
	 */
	async renderTimelineReport(
		result: TimelineReportResult,
		options: PdfOptions = DEFAULT_PDF_OPTIONS
	): Promise<void> {
		await this.ensurePdfMake();

		const defaultFont = this.getDefaultFont(options.fontStyle);
		const defaultTitle = 'Timeline Report';
		const defaultSubtitle = result.dateRange.from && result.dateRange.to
			? `${result.dateRange.from} to ${result.dateRange.to}`
			: 'All events';

		// Apply custom title based on scope
		const scope = options.customTitleScope || 'both';
		const coverTitle = (scope === 'cover' || scope === 'both') ? (options.customTitle || defaultTitle) : defaultTitle;
		const headerTitle = (scope === 'headers' || scope === 'both') ? (options.customTitle || defaultTitle) : defaultTitle;
		const subtitle = options.customSubtitle || defaultSubtitle;

		const content: Content[] = [];

		// Cover page (if enabled)
		if (options.includeCoverPage) {
			content.push(...this.buildCoverPage(coverTitle, subtitle, options.logoDataUrl, options.coverNotes, options.dateFormat));
		}

		// Title
		content.push({ text: coverTitle, style: 'title' });
		content.push({ text: subtitle, style: 'subtitle' });

		// Summary
		content.push(this.buildSectionHeader('Summary'));
		content.push(this.buildKeyValueTable([
			{ label: 'Total events', value: result.summary.eventCount.toString() },
			{ label: 'Participants', value: result.summary.participantCount.toString() },
			{ label: 'Places', value: result.summary.placeCount.toString() }
		]));

		// Events (grouped or flat)
		if (result.groupedEntries) {
			const keys = Object.keys(result.groupedEntries).sort();
			for (const key of keys) {
				const groupEntries = result.groupedEntries[key];
				content.push(this.buildSectionHeader(key));
				content.push(this.buildDataTable(
					['Date', 'Event', 'Participants', 'Place'],
					groupEntries.map(e => [
						e.date,
						e.type,
						e.participants.map(p => p.name).join(', '),
						this.stripWikilinks(e.place)
					]),
					[70, 80, '*', '*']
				));
			}
		} else {
			content.push(this.buildSectionHeader('Events'));
			content.push(this.buildDataTable(
				['Date', 'Event', 'Participants', 'Place'],
				result.entries.map(e => [
					e.date,
					e.type,
					e.participants.map(p => p.name).join(', '),
					this.stripWikilinks(e.place)
				]),
				[70, 80, '*', '*']
			));
		}

		const docDefinition: TDocumentDefinitions = {
			pageSize: options.pageSize,
			pageMargins: [40, 60, 40, 60],
			defaultStyle: {
				font: defaultFont,
				fontSize: 10
			},
			header: this.createHeader(headerTitle),
			footer: this.createFooter(options.dateFormat),
			content,
			styles: this.getStyles(options.fontStyle)
		};

		const filename = `Timeline-Report-${new Date().toISOString().split('T')[0]}.pdf`;
		this.pdfMake.createPdf(docDefinition).download(filename);

		new Notice('PDF downloaded');
	}

	/**
	 * Render Place Summary to PDF
	 */
	async renderPlaceSummary(
		result: PlaceSummaryResult,
		options: PdfOptions = DEFAULT_PDF_OPTIONS
	): Promise<void> {
		await this.ensurePdfMake();

		const defaultFont = this.getDefaultFont(options.fontStyle);
		const defaultTitle = 'Place Summary';
		const defaultSubtitle = result.place.name;

		// Apply custom title based on scope
		const scope = options.customTitleScope || 'both';
		const coverTitle = (scope === 'cover' || scope === 'both') ? (options.customTitle || defaultTitle) : defaultTitle;
		const headerTitle = (scope === 'headers' || scope === 'both') ? (options.customTitle || defaultTitle) : defaultTitle;
		const subtitle = options.customSubtitle || defaultSubtitle;

		const content: Content[] = [];

		// Cover page (if enabled)
		if (options.includeCoverPage) {
			content.push(...this.buildCoverPage(coverTitle, subtitle, options.logoDataUrl, options.coverNotes, options.dateFormat));
		}

		// Title
		content.push({ text: coverTitle, style: 'title' });
		content.push({ text: subtitle, style: 'subtitle' });

		// Place info
		const placeData: Array<{ label: string; value: string }> = [];
		if (result.place.hierarchy.length > 0) {
			placeData.push({ label: 'Location', value: [...result.place.hierarchy, result.place.name].join(' > ') });
		}
		if (result.place.type) {
			placeData.push({ label: 'Type', value: result.place.type });
		}
		if (result.place.coordinates) {
			placeData.push({ label: 'Coordinates', value: `${result.place.coordinates.lat}, ${result.place.coordinates.lng}` });
		}
		if (placeData.length > 0) {
			content.push(this.buildKeyValueTable(placeData));
		}

		// Summary
		content.push(this.buildSectionHeader('Summary'));
		const summaryData: Array<{ label: string; value: string }> = [
			{ label: 'Total events', value: result.summary.eventCount.toString() },
			{ label: 'People associated', value: result.summary.personCount.toString() }
		];
		if (result.summary.dateRange.earliest || result.summary.dateRange.latest) {
			const range = [result.summary.dateRange.earliest, result.summary.dateRange.latest].filter(Boolean).join(' to ');
			summaryData.push({ label: 'Date range', value: range });
		}
		content.push(this.buildKeyValueTable(summaryData));

		// Births
		if (result.births.length > 0) {
			content.push(this.buildSectionHeader(`Births (${result.births.length})`));
			content.push(this.buildDataTable(
				['Person', 'Date'],
				result.births.map(b => [b.person.name, b.date || '']),
				['*', 100]
			));
		}

		// Deaths
		if (result.deaths.length > 0) {
			content.push(this.buildSectionHeader(`Deaths (${result.deaths.length})`));
			content.push(this.buildDataTable(
				['Person', 'Date'],
				result.deaths.map(d => [d.person.name, d.date || '']),
				['*', 100]
			));
		}

		// Marriages
		if (result.marriages.length > 0) {
			content.push(this.buildSectionHeader(`Marriages (${result.marriages.length})`));
			content.push(this.buildDataTable(
				['Couple', 'Date'],
				result.marriages.map(m => [m.couple, m.date || '']),
				['*', 100]
			));
		}

		// Residences
		if (result.residences.length > 0) {
			content.push(this.buildSectionHeader(`Residences (${result.residences.length})`));
			content.push(this.buildDataTable(
				['Person', 'Period'],
				result.residences.map(r => [r.person.name, r.period || '']),
				['*', 100]
			));
		}

		// Other events
		if (result.otherEvents.length > 0) {
			content.push(this.buildSectionHeader(`Other Events (${result.otherEvents.length})`));
			content.push(this.buildDataTable(
				['Date', 'Event', 'Participants'],
				result.otherEvents.map(e => [
					e.date,
					e.type,
					e.participants.map(p => p.name).join(', ')
				]),
				[80, 80, '*']
			));
		}

		const docDefinition: TDocumentDefinitions = {
			pageSize: options.pageSize,
			pageMargins: [40, 60, 40, 60],
			defaultStyle: {
				font: defaultFont,
				fontSize: 10
			},
			header: this.createHeader(headerTitle),
			footer: this.createFooter(options.dateFormat),
			content,
			styles: this.getStyles(options.fontStyle)
		};

		const filename = `Place-Summary-${result.place.name.replace(/\s+/g, '-')}.pdf`;
		this.pdfMake.createPdf(docDefinition).download(filename);

		new Notice('PDF downloaded');
	}

	/**
	 * Render Media Inventory to PDF
	 */
	async renderMediaInventory(
		result: MediaInventoryResult,
		options: PdfOptions = DEFAULT_PDF_OPTIONS
	): Promise<void> {
		await this.ensurePdfMake();

		const defaultFont = this.getDefaultFont(options.fontStyle);
		const defaultTitle = 'Media Inventory';
		const defaultSubtitle = `${result.summary.totalFiles} files`;

		// Apply custom title based on scope
		const scope = options.customTitleScope || 'both';
		const coverTitle = (scope === 'cover' || scope === 'both') ? (options.customTitle || defaultTitle) : defaultTitle;
		const headerTitle = (scope === 'headers' || scope === 'both') ? (options.customTitle || defaultTitle) : defaultTitle;
		const subtitle = options.customSubtitle || defaultSubtitle;

		const content: Content[] = [];

		// Cover page (if enabled)
		if (options.includeCoverPage) {
			content.push(...this.buildCoverPage(coverTitle, subtitle, options.logoDataUrl, options.coverNotes, options.dateFormat));
		}

		// Title
		content.push({ text: coverTitle, style: 'title' });
		content.push({ text: subtitle, style: 'subtitle' });

		// Summary
		content.push(this.buildSectionHeader('Summary'));
		const summaryData: Array<{ label: string; value: string }> = [
			{ label: 'Total files', value: result.summary.totalFiles.toString() },
			{ label: 'Linked files', value: result.summary.linkedCount.toString() },
			{ label: 'Orphaned files', value: result.summary.orphanedCount.toString() }
		];
		if (result.summary.totalSize) {
			summaryData.push({ label: 'Total size', value: this.formatFileSize(result.summary.totalSize) });
		}
		content.push(this.buildKeyValueTable(summaryData));

		// File type breakdown
		const fileTypes = Object.entries(result.byFileType);
		if (fileTypes.length > 0) {
			content.push(this.buildSectionHeader('By File Type'));
			content.push(this.buildDataTable(
				['Type', 'Count'],
				fileTypes.map(([type, count]) => [type, count.toString()]),
				['*', 80]
			));
		}

		// Entity type breakdown
		const entityTypes = Object.entries(result.byEntityType);
		if (entityTypes.length > 0) {
			content.push(this.buildSectionHeader('By Entity Type'));
			content.push(this.buildDataTable(
				['Entity Type', 'Count'],
				entityTypes.map(([type, count]) => [type, count.toString()]),
				['*', 80]
			));
		}

		// Linked media
		if (result.linkedMedia.length > 0) {
			content.push(this.buildSectionHeader(`Linked Media (${result.linkedMedia.length})`));
			content.push(this.buildDataTable(
				['File', 'Type', 'Linked To'],
				result.linkedMedia.slice(0, 50).map(m => [
					m.name,
					m.extension,
					m.linkedEntities.map(e => e.name).join(', ')
				]),
				['*', 50, '*']
			));
			if (result.linkedMedia.length > 50) {
				content.push({
					text: `... and ${result.linkedMedia.length - 50} more files`,
					style: 'note',
					margin: [0, 5, 0, 10]
				});
			}
		}

		// Orphaned media
		if (result.orphanedMedia.length > 0) {
			content.push(this.buildSectionHeader(`Orphaned Media (${result.orphanedMedia.length})`));
			content.push(this.buildDataTable(
				['File', 'Type', 'Path'],
				result.orphanedMedia.slice(0, 50).map(m => [
					m.name,
					m.extension,
					m.path
				]),
				['*', 50, '*']
			));
			if (result.orphanedMedia.length > 50) {
				content.push({
					text: `... and ${result.orphanedMedia.length - 50} more files`,
					style: 'note',
					margin: [0, 5, 0, 10]
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
			header: this.createHeader(headerTitle),
			footer: this.createFooter(options.dateFormat),
			content,
			styles: this.getStyles(options.fontStyle)
		};

		const filename = `Media-Inventory-${new Date().toISOString().split('T')[0]}.pdf`;
		this.pdfMake.createPdf(docDefinition).download(filename);

		new Notice('PDF downloaded');
	}

	/**
	 * Render Universe Overview to PDF
	 */
	async renderUniverseOverview(
		result: UniverseOverviewResult,
		options: PdfOptions = DEFAULT_PDF_OPTIONS
	): Promise<void> {
		await this.ensurePdfMake();

		const defaultFont = this.getDefaultFont(options.fontStyle);
		const defaultTitle = 'Universe Overview';
		const defaultSubtitle = result.universe.name;

		// Apply custom title based on scope
		const scope = options.customTitleScope || 'both';
		const coverTitle = (scope === 'cover' || scope === 'both') ? (options.customTitle || defaultTitle) : defaultTitle;
		const headerTitle = (scope === 'headers' || scope === 'both') ? (options.customTitle || defaultTitle) : defaultTitle;
		const subtitle = options.customSubtitle || defaultSubtitle;

		const content: Content[] = [];

		// Cover page (if enabled)
		if (options.includeCoverPage) {
			content.push(...this.buildCoverPage(coverTitle, subtitle, options.logoDataUrl, options.coverNotes, options.dateFormat));
		}

		// Title
		content.push({ text: coverTitle, style: 'title' });
		content.push({ text: subtitle, style: 'subtitle' });

		// Description
		if (result.universe.description) {
			content.push({
				text: result.universe.description,
				italics: true,
				alignment: 'center',
				margin: [0, 0, 0, 20]
			});
		}

		// Summary
		content.push(this.buildSectionHeader('Summary'));
		const summaryData: Array<{ label: string; value: string }> = [
			{ label: 'Total entities', value: result.summary.totalEntities.toString() }
		];
		if (result.summary.dateRange?.earliest || result.summary.dateRange?.latest) {
			const range = [result.summary.dateRange.earliest, result.summary.dateRange.latest].filter(Boolean).join(' to ');
			summaryData.push({ label: 'Date range', value: range });
		}
		content.push(this.buildKeyValueTable(summaryData));

		// Entity breakdown
		const entityTypes = Object.entries(result.summary.byType).filter(([_, count]) => count > 0);
		if (entityTypes.length > 0) {
			content.push(this.buildSectionHeader('Entity Breakdown'));
			content.push(this.buildDataTable(
				['Type', 'Count'],
				entityTypes.map(([type, count]) => [type, count.toString()]),
				['*', 80]
			));
		}

		// Date systems
		if (result.dateSystems.length > 0) {
			content.push(this.buildSectionHeader('Date Systems'));
			content.push({
				ul: result.dateSystems,
				margin: [20, 0, 0, 10]
			});
		}

		// Geographic summary
		if (result.geographicSummary) {
			content.push(this.buildSectionHeader('Geographic Summary'));
			const coverage = result.geographicSummary.totalPlaces > 0
				? Math.round((result.geographicSummary.placesWithCoordinates / result.geographicSummary.totalPlaces) * 100)
				: 0;
			content.push(this.buildKeyValueTable([
				{ label: 'Total places', value: result.geographicSummary.totalPlaces.toString() },
				{ label: 'With coordinates', value: result.geographicSummary.placesWithCoordinates.toString() },
				{ label: 'Coverage', value: `${coverage}%` }
			]));
		}

		// Entity lists
		if (result.entityLists) {
			for (const [type, entities] of Object.entries(result.entityLists)) {
				if (entities.length > 0) {
					content.push(this.buildSectionHeader(type.charAt(0).toUpperCase() + type.slice(1)));
					content.push({
						ul: entities.map(e => e.name),
						margin: [20, 0, 0, 10]
					});
				}
			}
		}

		// Recent activity
		if (result.recentActivity && result.recentActivity.length > 0) {
			content.push(this.buildSectionHeader('Recent Activity'));
			content.push(this.buildDataTable(
				['Entity', 'Type', 'Modified'],
				result.recentActivity.map(a => [a.name, a.type, a.modified]),
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
			header: this.createHeader(headerTitle),
			footer: this.createFooter(options.dateFormat),
			content,
			styles: this.getStyles(options.fontStyle)
		};

		const filename = `Universe-Overview-${result.universe.name.replace(/\s+/g, '-')}.pdf`;
		this.pdfMake.createPdf(docDefinition).download(filename);

		new Notice('PDF downloaded');
	}

	/**
	 * Render Collection Overview to PDF
	 */
	async renderCollectionOverview(
		result: CollectionOverviewResult,
		options: PdfOptions = DEFAULT_PDF_OPTIONS
	): Promise<void> {
		await this.ensurePdfMake();

		const defaultFont = this.getDefaultFont(options.fontStyle);
		const defaultTitle = 'Collection Overview';
		const defaultSubtitle = result.collection.name;

		// Apply custom title based on scope
		const scope = options.customTitleScope || 'both';
		const coverTitle = (scope === 'cover' || scope === 'both') ? (options.customTitle || defaultTitle) : defaultTitle;
		const headerTitle = (scope === 'headers' || scope === 'both') ? (options.customTitle || defaultTitle) : defaultTitle;
		const subtitle = options.customSubtitle || defaultSubtitle;

		const content: Content[] = [];

		// Cover page (if enabled)
		if (options.includeCoverPage) {
			content.push(...this.buildCoverPage(coverTitle, subtitle, options.logoDataUrl, options.coverNotes, options.dateFormat));
		}

		// Title
		content.push({ text: coverTitle, style: 'title' });
		content.push({ text: subtitle, style: 'subtitle' });

		// Collection type note
		const typeLabel = result.collection.type === 'user' ? 'User-defined collection' : 'Auto-detected family group';
		content.push({
			text: typeLabel,
			italics: true,
			alignment: 'center',
			margin: [0, 0, 0, 20]
		});

		// Summary
		content.push(this.buildSectionHeader('Summary'));
		const summaryData: Array<{ label: string; value: string }> = [
			{ label: 'Members', value: result.summary.memberCount.toString() },
			{ label: 'Generations', value: result.summary.generationDepth.toString() }
		];
		if (result.summary.dateRange.earliest || result.summary.dateRange.latest) {
			const range = [result.summary.dateRange.earliest, result.summary.dateRange.latest].filter(Boolean).join(' to ');
			summaryData.push({ label: 'Date range', value: range });
		}
		content.push(this.buildKeyValueTable(summaryData));

		// Generation analysis
		if (result.generationAnalysis) {
			content.push(this.buildSectionHeader('Generation Analysis'));
			const gens = Object.entries(result.generationAnalysis)
				.map(([gen, count]) => [gen, count.toString()])
				.sort((a, b) => parseInt(a[0], 10) - parseInt(b[0], 10));
			content.push(this.buildDataTable(
				['Generation', 'Count'],
				gens,
				['*', 80]
			));
		}

		// Surname distribution
		if (result.surnameDistribution && result.surnameDistribution.length > 0) {
			content.push(this.buildSectionHeader('Surname Distribution'));
			content.push(this.buildDataTable(
				['Surname', 'Count'],
				result.surnameDistribution.map(s => [s.surname, s.count.toString()]),
				['*', 80]
			));
		}

		// Geographic distribution
		if (result.geographicDistribution && result.geographicDistribution.length > 0) {
			content.push(this.buildSectionHeader('Geographic Distribution'));
			content.push(this.buildDataTable(
				['Place', 'Count'],
				result.geographicDistribution.map(g => [g.place, g.count.toString()]),
				['*', 80]
			));
		}

		// Member list
		if (result.members.length > 0) {
			content.push(this.buildSectionHeader(`Members (${result.members.length})`));
			content.push(this.buildDataTable(
				['Name', 'Birth', 'Death'],
				result.members.map(m => [m.name, m.birthDate || '', m.deathDate || '']),
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
			header: this.createHeader(headerTitle),
			footer: this.createFooter(options.dateFormat),
			content,
			styles: this.getStyles(options.fontStyle)
		};

		const filename = `Collection-Overview-${result.collection.name.replace(/\s+/g, '-')}.pdf`;
		this.pdfMake.createPdf(docDefinition).download(filename);

		new Notice('PDF downloaded');
	}

	/**
	 * Format file size for display
	 */
	private formatFileSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
		return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
	}

	/**
	 * Render Visual Tree to PDF
	 *
	 * Generates a graphical tree diagram by rendering to SVG first,
	 * converting to a PNG image, and embedding in the PDF.
	 * This approach is more reliable than pdfmake's canvas primitives.
	 */
	async renderVisualTree(
		layout: VisualTreeLayout,
		options: VisualTreeOptions
	): Promise<void> {
		await this.ensurePdfMake();

		const defaultFont = this.getDefaultFont('sans-serif');

		// Use SVG renderer to generate the tree image
		const svgRenderer = new VisualTreeSvgRenderer();
		const svgString = svgRenderer.renderToSvg(layout, options);
		const imageDataUrl = await svgRenderer.svgToDataUrl(svgString, layout.page.width, layout.page.height);

		// Build document content
		const content: Content[] = [];

		// Title
		content.push({
			text: options.title || `${layout.rootPerson.name} - ${this.getChartTypeTitle(layout.type)}`,
			style: 'title',
			margin: [0, 0, 0, 10]
		});

		// Stats line
		content.push({
			text: `${layout.stats.peopleCount} people across ${layout.stats.generationsCount} generations`,
			alignment: 'center',
			fontSize: 10,
			color: COLORS.mutedText,
			margin: [0, 0, 0, 20]
		});

		// Add the tree image - only specify width to let pdfmake maintain aspect ratio
		// (specifying both width and height causes resampling which degrades quality)
		const imageWidth = layout.page.width - layout.margins.left - layout.margins.right;

		content.push({
			image: imageDataUrl,
			width: imageWidth,
			alignment: 'center'
		});

		const docDefinition: TDocumentDefinitions = {
			pageSize: {
				width: layout.page.width,
				height: layout.page.height
			},
			pageOrientation: layout.orientation,
			pageMargins: [layout.margins.left, layout.margins.top + 40, layout.margins.right, layout.margins.bottom],
			defaultStyle: {
				font: defaultFont,
				fontSize: 10
			},
			content,
			styles: this.getStyles('sans-serif')
		};

		const filename = `${layout.rootPerson.name.replace(/\s+/g, '-')}-${layout.type}-tree.pdf`;
		this.pdfMake.createPdf(docDefinition).download(filename);

		new Notice('PDF downloaded');
	}

	/**
	 * Render multiple Visual Tree layouts to a single multi-page PDF
	 *
	 * Used for large trees that are split across multiple pages.
	 */
	async renderVisualTrees(
		layouts: VisualTreeLayout[],
		options: VisualTreeOptions
	): Promise<void> {
		if (layouts.length === 0) {
			new Notice('No layouts to render');
			return;
		}

		// Single layout - use simpler method
		if (layouts.length === 1) {
			return this.renderVisualTree(layouts[0], options);
		}

		await this.ensurePdfMake();

		const defaultFont = this.getDefaultFont('sans-serif');
		const svgRenderer = new VisualTreeSvgRenderer();

		// Build document content with multiple pages
		const content: Content[] = [];

		for (let i = 0; i < layouts.length; i++) {
			const layout = layouts[i];

			// Page break before all pages except the first
			if (i > 0) {
				content.push({ text: '', pageBreak: 'before' });
			}

			// Title with page info
			const pageInfo = layout.generationRange
				? `Generations ${layout.generationRange.from + 1}-${layout.generationRange.to + 1}`
				: `Page ${i + 1}`;

			content.push({
				text: options.title || `${layout.rootPerson.name} - ${this.getChartTypeTitle(layout.type)}`,
				style: 'title',
				margin: [0, 0, 0, 5]
			});

			// Page/generation info
			content.push({
				text: `${pageInfo} (${layout.stats.peopleCount} people) — Page ${i + 1} of ${layouts.length}`,
				alignment: 'center',
				fontSize: 10,
				color: COLORS.mutedText,
				margin: [0, 0, 0, 15]
			});

			// Render SVG for this page
			const svgString = svgRenderer.renderToSvg(layout, options);
			const imageDataUrl = await svgRenderer.svgToDataUrl(svgString, layout.page.width, layout.page.height);

			// Add the tree image - only specify width to let pdfmake maintain aspect ratio
			const imageWidth = layout.page.width - layout.margins.left - layout.margins.right;

			content.push({
				image: imageDataUrl,
				width: imageWidth,
				alignment: 'center'
			});
		}

		// Use first layout's page settings
		const firstLayout = layouts[0];

		const docDefinition: TDocumentDefinitions = {
			pageSize: {
				width: firstLayout.page.width,
				height: firstLayout.page.height
			},
			pageOrientation: firstLayout.orientation,
			pageMargins: [firstLayout.margins.left, firstLayout.margins.top + 40, firstLayout.margins.right, firstLayout.margins.bottom],
			defaultStyle: {
				font: defaultFont,
				fontSize: 10
			},
			content,
			styles: this.getStyles('sans-serif')
		};

		const filename = `${firstLayout.rootPerson.name.replace(/\s+/g, '-')}-${firstLayout.type}-tree.pdf`;
		this.pdfMake.createPdf(docDefinition).download(filename);

		new Notice('PDF downloaded');
	}

	/**
	 * Get chart type display title
	 */
	private getChartTypeTitle(type: VisualTreeLayout['type']): string {
		switch (type) {
			case 'pedigree': return 'Pedigree Chart';
			case 'descendant': return 'Descendant Chart';
			case 'hourglass': return 'Hourglass Chart';
			case 'fan': return 'Fan Chart';
		}
	}
}
