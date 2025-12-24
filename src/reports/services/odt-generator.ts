/**
 * ODT Generator
 *
 * Generates ODT (Open Document Text) files from markdown content.
 * Uses JSZip (already available in Obsidian) for creating the ODT archive.
 */

import JSZip from 'jszip';
import { getLogger } from '../../core/logging';

const logger = getLogger('OdtGenerator');

/**
 * Options for ODT generation
 */
export interface OdtExportOptions {
	title?: string;
	subtitle?: string;
	author?: string;
	includeCoverPage: boolean;
}

/**
 * Generator for ODT (Open Document Text) files
 */
export class OdtGenerator {
	private zip: JSZip;

	constructor() {
		this.zip = new JSZip();
	}

	/**
	 * Generate an ODT file from markdown content
	 * @param markdown - The markdown content to convert
	 * @param options - ODT export options
	 * @returns A Blob containing the ODT file
	 */
	async generate(markdown: string, options: OdtExportOptions): Promise<Blob> {
		logger.info('generate', 'Generating ODT document', { title: options.title });

		// Reset zip for new document
		this.zip = new JSZip();

		// Add required ODT components
		this.addMimetype();
		this.addManifest();
		this.addStyles();
		this.addContent(markdown, options);

		// Generate the ODT file
		const blob = await this.zip.generateAsync({
			type: 'blob',
			mimeType: 'application/vnd.oasis.opendocument.text'
		});

		logger.info('generate', 'ODT document generated successfully');
		return blob;
	}

	/**
	 * Add the mimetype file (must be first, uncompressed)
	 */
	private addMimetype(): void {
		this.zip.file('mimetype', 'application/vnd.oasis.opendocument.text', {
			compression: 'STORE'
		});
	}

	/**
	 * Add the manifest file
	 */
	private addManifest(): void {
		const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">
  <manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/>
  <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
  <manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>
</manifest:manifest>`;

		this.zip.file('META-INF/manifest.xml', manifest);
	}

	/**
	 * Add the styles file
	 */
	private addStyles(): void {
		const styles = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
                        xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
                        xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"
                        xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
                        office:version="1.2">
  <office:styles>
    <!-- Title style -->
    <style:style style:name="Title" style:family="paragraph" style:class="chapter">
      <style:paragraph-properties fo:text-align="center" fo:margin-top="0cm" fo:margin-bottom="0.5cm"/>
      <style:text-properties fo:font-size="24pt" fo:font-weight="bold"/>
    </style:style>

    <!-- Subtitle style -->
    <style:style style:name="Subtitle" style:family="paragraph" style:class="chapter">
      <style:paragraph-properties fo:text-align="center" fo:margin-top="0cm" fo:margin-bottom="1cm"/>
      <style:text-properties fo:font-size="14pt" fo:color="#555555"/>
    </style:style>

    <!-- Heading 1 style -->
    <style:style style:name="Heading_20_1" style:display-name="Heading 1" style:family="paragraph" style:class="text">
      <style:paragraph-properties fo:margin-top="0.5cm" fo:margin-bottom="0.25cm" fo:keep-with-next="always"/>
      <style:text-properties fo:font-size="18pt" fo:font-weight="bold"/>
    </style:style>

    <!-- Heading 2 style -->
    <style:style style:name="Heading_20_2" style:display-name="Heading 2" style:family="paragraph" style:class="text">
      <style:paragraph-properties fo:margin-top="0.4cm" fo:margin-bottom="0.2cm" fo:keep-with-next="always"/>
      <style:text-properties fo:font-size="14pt" fo:font-weight="bold"/>
    </style:style>

    <!-- Heading 3 style -->
    <style:style style:name="Heading_20_3" style:display-name="Heading 3" style:family="paragraph" style:class="text">
      <style:paragraph-properties fo:margin-top="0.3cm" fo:margin-bottom="0.15cm" fo:keep-with-next="always"/>
      <style:text-properties fo:font-size="12pt" fo:font-weight="bold"/>
    </style:style>

    <!-- Standard paragraph style -->
    <style:style style:name="Standard" style:family="paragraph" style:class="text">
      <style:paragraph-properties fo:margin-top="0cm" fo:margin-bottom="0.2cm"/>
      <style:text-properties fo:font-size="11pt"/>
    </style:style>

    <!-- List item style -->
    <style:style style:name="List_20_Paragraph" style:display-name="List Paragraph" style:family="paragraph" style:class="text">
      <style:paragraph-properties fo:margin-left="0.5cm" fo:margin-top="0cm" fo:margin-bottom="0.1cm"/>
      <style:text-properties fo:font-size="11pt"/>
    </style:style>

    <!-- Bold text style -->
    <style:style style:name="Bold" style:family="text">
      <style:text-properties fo:font-weight="bold"/>
    </style:style>

    <!-- Italic text style -->
    <style:style style:name="Italic" style:family="text">
      <style:text-properties fo:font-style="italic"/>
    </style:style>

    <!-- Small caps text style -->
    <style:style style:name="SmallCaps" style:family="text">
      <style:text-properties fo:font-variant="small-caps"/>
    </style:style>

    <!-- Horizontal rule style -->
    <style:style style:name="Horizontal_20_Line" style:display-name="Horizontal Line" style:family="paragraph">
      <style:paragraph-properties fo:margin-top="0.3cm" fo:margin-bottom="0.3cm" fo:border-bottom="0.5pt solid #000000"/>
    </style:style>
  </office:styles>
</office:document-styles>`;

		this.zip.file('styles.xml', styles);
	}

	/**
	 * Add the content file
	 */
	private addContent(markdown: string, options: OdtExportOptions): void {
		// Convert markdown to ODT content
		const bodyContent = this.markdownToOdtContent(markdown);

		// Generate cover page if enabled
		let coverPage = '';
		if (options.includeCoverPage && options.title) {
			coverPage = this.generateCoverPage(options);
		}

		const content = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
                         xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
                         xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
                         xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"
                         xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"
                         office:version="1.2">
  <office:automatic-styles>
    <style:style style:name="Table" style:family="table">
      <style:table-properties style:width="17cm" table:align="margins"/>
    </style:style>
    <style:style style:name="Table.Column" style:family="table-column">
      <style:table-column-properties style:use-optimal-column-width="true"/>
    </style:style>
    <style:style style:name="Table.Row" style:family="table-row">
      <style:table-row-properties style:min-row-height="0.5cm"/>
    </style:style>
    <style:style style:name="Table.Cell" style:family="table-cell">
      <style:table-cell-properties fo:padding-top="0.15cm" fo:padding-bottom="0.15cm" fo:padding-left="0.2cm" fo:padding-right="0.2cm" fo:border="0.5pt solid #888888"/>
    </style:style>
    <style:style style:name="Table.HeaderCell" style:family="table-cell">
      <style:table-cell-properties fo:padding-top="0.15cm" fo:padding-bottom="0.15cm" fo:padding-left="0.2cm" fo:padding-right="0.2cm" fo:border="0.5pt solid #666666" fo:background-color="#d0d0d0"/>
    </style:style>
    <style:style style:name="Table.CellContent" style:family="paragraph">
      <style:paragraph-properties fo:margin-top="0cm" fo:margin-bottom="0cm"/>
      <style:text-properties fo:font-size="10pt"/>
    </style:style>
    <style:style style:name="Table.HeaderContent" style:family="paragraph">
      <style:paragraph-properties fo:margin-top="0cm" fo:margin-bottom="0cm"/>
      <style:text-properties fo:font-size="10pt" fo:font-weight="bold"/>
    </style:style>
  </office:automatic-styles>
  <office:body>
    <office:text>
${coverPage}${bodyContent}
    </office:text>
  </office:body>
</office:document-content>`;

		this.zip.file('content.xml', content);
	}

	/**
	 * Generate cover page content
	 */
	private generateCoverPage(options: OdtExportOptions): string {
		let content = '';

		// Add some vertical space before title
		content += '      <text:p text:style-name="Standard"/>\n';
		content += '      <text:p text:style-name="Standard"/>\n';

		if (options.title) {
			content += `      <text:p text:style-name="Title">${this.escapeXml(options.title)}</text:p>\n`;
		}

		if (options.subtitle) {
			content += `      <text:p text:style-name="Subtitle">${this.escapeXml(options.subtitle)}</text:p>\n`;
		}

		if (options.author) {
			content += `      <text:p text:style-name="Subtitle">${this.escapeXml(options.author)}</text:p>\n`;
		}

		// Add page break after cover
		content += '      <text:p text:style-name="Standard"><text:soft-page-break/></text:p>\n';

		return content;
	}

	/**
	 * Convert markdown content to ODT XML
	 */
	private markdownToOdtContent(markdown: string): string {
		const lines = markdown.split('\n');
		const result: string[] = [];
		let inList = false;
		let tableCounter = 0;

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];

			// Check for table start (line starting with |)
			if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
				if (inList) { inList = false; }

				// Collect all table lines
				const tableLines: string[] = [line];
				while (i + 1 < lines.length) {
					const nextLine = lines[i + 1];
					if (nextLine.trim().startsWith('|') && nextLine.trim().endsWith('|')) {
						tableLines.push(nextLine);
						i++;
					} else {
						break;
					}
				}

				// Parse and render the table
				tableCounter++;
				const tableXml = this.parseMarkdownTable(tableLines, tableCounter);
				result.push(tableXml);
				continue;
			}

			// Headings
			if (line.startsWith('# ')) {
				if (inList) { inList = false; }
				result.push(`      <text:p text:style-name="Heading_20_1">${this.processInlineFormatting(line.slice(2))}</text:p>`);
			} else if (line.startsWith('## ')) {
				if (inList) { inList = false; }
				result.push(`      <text:p text:style-name="Heading_20_2">${this.processInlineFormatting(line.slice(3))}</text:p>`);
			} else if (line.startsWith('### ')) {
				if (inList) { inList = false; }
				result.push(`      <text:p text:style-name="Heading_20_3">${this.processInlineFormatting(line.slice(4))}</text:p>`);
			}
			// Horizontal rule
			else if (line.match(/^---+$/) || line.match(/^\*\*\*+$/) || line.match(/^___+$/)) {
				if (inList) { inList = false; }
				result.push('      <text:p text:style-name="Horizontal_20_Line"/>');
			}
			// Unordered list items
			else if (line.match(/^(\s*)-\s+/)) {
				const match = line.match(/^(\s*)-\s+(.*)$/);
				if (match) {
					const content = match[2];
					inList = true;
					result.push(`      <text:p text:style-name="List_20_Paragraph">• ${this.processInlineFormatting(content)}</text:p>`);
				}
			}
			// Ordered list items (numbered)
			else if (line.match(/^(\s*)\d+\.\s+/)) {
				const match = line.match(/^(\s*)(\d+)\.\s+(.*)$/);
				if (match) {
					const num = match[2];
					const content = match[3];
					inList = true;
					result.push(`      <text:p text:style-name="List_20_Paragraph">${num}. ${this.processInlineFormatting(content)}</text:p>`);
				}
			}
			// Continuation of list item (indented under previous)
			else if (inList && line.match(/^\s+/) && line.trim()) {
				const trimmed = line.trim();
				// Check if it's a sub-item
				if (trimmed.startsWith('- ')) {
					result.push(`      <text:p text:style-name="List_20_Paragraph">  • ${this.processInlineFormatting(trimmed.slice(2))}</text:p>`);
				} else {
					result.push(`      <text:p text:style-name="List_20_Paragraph">  ${this.processInlineFormatting(trimmed)}</text:p>`);
				}
			}
			// Empty line
			else if (!line.trim()) {
				if (inList) { inList = false; }
				result.push('      <text:p text:style-name="Standard"/>');
			}
			// Regular paragraph
			else {
				if (inList) { inList = false; }
				result.push(`      <text:p text:style-name="Standard">${this.processInlineFormatting(line)}</text:p>`);
			}
		}

		return result.join('\n');
	}

	/**
	 * Parse a markdown table and convert to ODT table XML
	 */
	private parseMarkdownTable(lines: string[], tableId: number): string {
		if (lines.length < 2) {
			// Not enough lines for a valid table
			return lines.map(line =>
				`      <text:p text:style-name="Standard">${this.processInlineFormatting(line)}</text:p>`
			).join('\n');
		}

		// Parse header row
		const headerCells = this.parseTableRow(lines[0]);

		// Check if second line is a separator (contains only |, -, :, and spaces)
		const isSeparator = /^[\s|:-]+$/.test(lines[1]);
		const dataStartIndex = isSeparator ? 2 : 1;

		// Parse data rows
		const dataRows: string[][] = [];
		for (let i = dataStartIndex; i < lines.length; i++) {
			const cells = this.parseTableRow(lines[i]);
			if (cells.length > 0) {
				dataRows.push(cells);
			}
		}

		// Determine column count (max of header and all data rows)
		const columnCount = Math.max(
			headerCells.length,
			...dataRows.map(row => row.length)
		);

		// Build table XML
		const tableName = `Table${tableId}`;
		const tableXml: string[] = [];

		tableXml.push(`      <table:table table:name="${tableName}" table:style-name="Table">`);

		// Column definitions
		for (let c = 0; c < columnCount; c++) {
			tableXml.push(`        <table:table-column table:style-name="Table.Column"/>`);
		}

		// Header row
		if (isSeparator && headerCells.length > 0) {
			tableXml.push('        <table:table-row table:style-name="Table.Row">');
			for (let c = 0; c < columnCount; c++) {
				const cellContent = c < headerCells.length ? headerCells[c] : '';
				tableXml.push('          <table:table-cell table:style-name="Table.HeaderCell">');
				tableXml.push(`            <text:p text:style-name="Table.HeaderContent">${this.processInlineFormatting(cellContent)}</text:p>`);
				tableXml.push('          </table:table-cell>');
			}
			tableXml.push('        </table:table-row>');
		} else {
			// No separator, treat first row as data
			dataRows.unshift(headerCells);
		}

		// Data rows
		for (const row of dataRows) {
			tableXml.push('        <table:table-row table:style-name="Table.Row">');
			for (let c = 0; c < columnCount; c++) {
				const cellContent = c < row.length ? row[c] : '';
				tableXml.push('          <table:table-cell table:style-name="Table.Cell">');
				tableXml.push(`            <text:p text:style-name="Table.CellContent">${this.processInlineFormatting(cellContent)}</text:p>`);
				tableXml.push('          </table:table-cell>');
			}
			tableXml.push('        </table:table-row>');
		}

		tableXml.push('      </table:table>');

		return tableXml.join('\n');
	}

	/**
	 * Parse a single markdown table row into cells
	 */
	private parseTableRow(line: string): string[] {
		// Remove leading and trailing pipes and split
		const trimmed = line.trim();
		const withoutPipes = trimmed.startsWith('|') ? trimmed.slice(1) : trimmed;
		const withoutEndPipe = withoutPipes.endsWith('|') ? withoutPipes.slice(0, -1) : withoutPipes;

		// Split by pipe and trim each cell
		return withoutEndPipe.split('|').map(cell => cell.trim());
	}

	/** Genealogy labels to render in small caps */
	private static readonly SMALL_CAPS_LABELS = [
		'Husband',
		'Wife',
		'Spouse',
		'Father',
		'Mother',
		'Son',
		'Daughter',
		'Child',
		'Children',
		'Marriage',
		'Married',
		'Birth',
		'Born',
		'Death',
		'Died',
		'Baptism',
		'Burial',
		'Occupation',
		'Residence',
		'Census',
		'Immigration',
		'Emigration',
		'Naturalization',
		'Military',
		'Education',
		'Religion',
		'Notes',
		'Sources'
	];

	/**
	 * Process inline formatting (bold, italic, links, wikilinks, small caps)
	 */
	private processInlineFormatting(text: string): string {
		// First escape XML special characters in the raw text
		let result = this.escapeXml(text);

		// Process bold (**text** or __text__)
		result = result.replace(/\*\*(.+?)\*\*/g, '<text:span text:style-name="Bold">$1</text:span>');
		result = result.replace(/__(.+?)__/g, '<text:span text:style-name="Bold">$1</text:span>');

		// Process italic (*text* or _text_) - be careful not to match already processed bold
		result = result.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<text:span text:style-name="Italic">$1</text:span>');
		result = result.replace(/(?<!_)_([^_]+?)_(?!_)/g, '<text:span text:style-name="Italic">$1</text:span>');

		// Convert wikilinks [[Name]] to plain text (bold for emphasis)
		result = result.replace(/\[\[([^\]|]+?)(\|([^\]]+?))?\]\]/g, (_, target, __, display) => {
			const linkText = display || target;
			return `<text:span text:style-name="Bold">${linkText}</text:span>`;
		});

		// Convert markdown links [text](url) to plain text (just show the text)
		result = result.replace(/\[([^\]]+?)\]\([^)]+?\)/g, '$1');

		// Apply small caps to genealogy labels (as standalone words followed by colon or at word boundary)
		for (const label of OdtGenerator.SMALL_CAPS_LABELS) {
			// Match label followed by colon, or as a standalone word
			const pattern = new RegExp(`\\b(${label})(:?)\\b`, 'g');
			result = result.replace(pattern, '<text:span text:style-name="SmallCaps">$1</text:span>$2');
		}

		return result;
	}

	/**
	 * Escape special XML characters
	 */
	private escapeXml(text: string): string {
		return text
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&apos;');
	}

	/**
	 * Download an ODT file
	 * @param blob - The ODT blob
	 * @param filename - The filename (without extension)
	 */
	static download(blob: Blob, filename: string): void {
		// Ensure filename has .odt extension
		const normalizedFilename = filename.endsWith('.odt') ? filename : `${filename.replace(/\.md$/, '')}.odt`;

		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = normalizedFilename;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);

		logger.info('download', `ODT downloaded as ${normalizedFilename}`);
	}
}
