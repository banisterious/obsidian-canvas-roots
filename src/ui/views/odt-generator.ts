/**
 * ODT (OpenDocument Text) Generator
 *
 * Generates ODT documents using JSZip for the Family Chart export feature.
 * ODT files are ZIP archives with a specific structure containing XML files.
 *
 * Structure:
 * - mimetype (uncompressed, must be first)
 * - META-INF/manifest.xml (file manifest)
 * - content.xml (document content)
 * - styles.xml (document styles)
 * - Pictures/ (embedded images)
 */

import JSZip from 'jszip';

export interface OdtOptions {
	/** Document title (shown in document properties) */
	title: string;
	/** Chart image as PNG data URL or base64 */
	chartImageData: string;
	/** Chart width in pixels */
	chartWidth: number;
	/** Chart height in pixels */
	chartHeight: number;
	/** Include cover page before chart */
	includeCoverPage: boolean;
	/** Cover page title */
	coverTitle?: string;
	/** Cover page subtitle */
	coverSubtitle?: string;
	/** Number of people in chart */
	peopleCount?: number;
	/** Root person name */
	rootPersonName?: string;
}

/**
 * Generate an ODT document containing a family chart image
 */
export async function generateOdt(options: OdtOptions): Promise<Blob> {
	const zip = new JSZip();

	// Extract base64 data from data URL if needed
	let imageData = options.chartImageData;
	if (imageData.startsWith('data:image/png;base64,')) {
		imageData = imageData.substring('data:image/png;base64,'.length);
	}

	// Convert base64 to binary for JSZip
	const imageBytes = base64ToUint8Array(imageData);

	// Calculate image dimensions in cm (ODT uses cm)
	// Assume 96 DPI for screen, convert to cm
	const dpi = 96;
	const cmPerInch = 2.54;
	const maxWidthCm = 17; // A4 width minus margins (21cm - 2*2cm)
	const maxHeightCm = 24; // A4 height minus margins (29.7cm - 2*2.85cm)

	let widthCm = (options.chartWidth / dpi) * cmPerInch;
	let heightCm = (options.chartHeight / dpi) * cmPerInch;

	// Scale down if too large, maintaining aspect ratio
	if (widthCm > maxWidthCm) {
		const scale = maxWidthCm / widthCm;
		widthCm = maxWidthCm;
		heightCm = heightCm * scale;
	}
	if (heightCm > maxHeightCm) {
		const scale = maxHeightCm / heightCm;
		heightCm = maxHeightCm;
		widthCm = widthCm * scale;
	}

	// Format dimensions for ODT (e.g., "17.5cm")
	const widthStr = `${widthCm.toFixed(3)}cm`;
	const heightStr = `${heightCm.toFixed(3)}cm`;

	// 1. mimetype - MUST be first and uncompressed
	zip.file('mimetype', 'application/vnd.oasis.opendocument.text', {
		compression: 'STORE'
	});

	// 2. META-INF/manifest.xml
	zip.file('META-INF/manifest.xml', generateManifest());

	// 3. content.xml
	zip.file('content.xml', generateContent(options, widthStr, heightStr));

	// 4. styles.xml
	zip.file('styles.xml', generateStyles());

	// 5. meta.xml (document metadata)
	zip.file('meta.xml', generateMeta(options.title));

	// 6. Pictures/chart.png
	zip.file('Pictures/chart.png', imageBytes, { binary: true });

	// Generate the ZIP file
	const blob = await zip.generateAsync({
		type: 'blob',
		mimeType: 'application/vnd.oasis.opendocument.text',
		compression: 'DEFLATE',
		compressionOptions: { level: 6 }
	});

	return blob;
}

/**
 * Convert base64 string to Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
	const binaryString = atob(base64);
	const bytes = new Uint8Array(binaryString.length);
	for (let i = 0; i < binaryString.length; i++) {
		bytes[i] = binaryString.charCodeAt(i);
	}
	return bytes;
}

/**
 * Generate manifest.xml content
 */
function generateManifest(): string {
	return `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3">
  <manifest:file-entry manifest:full-path="/" manifest:version="1.3" manifest:media-type="application/vnd.oasis.opendocument.text"/>
  <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
  <manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>
  <manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/>
  <manifest:file-entry manifest:full-path="Pictures/chart.png" manifest:media-type="image/png"/>
</manifest:manifest>`;
}

/**
 * Generate content.xml with optional cover page and chart image
 */
function generateContent(options: OdtOptions, widthStr: string, heightStr: string): string {
	const date = new Date().toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'long',
		day: 'numeric'
	});

	let bodyContent = '';

	// Cover page content
	if (options.includeCoverPage) {
		const title = escapeXml(options.coverTitle || 'Family Tree');
		const subtitle = options.coverSubtitle ? escapeXml(options.coverSubtitle) : '';
		const rootPerson = options.rootPersonName ? escapeXml(options.rootPersonName) : '';
		const peopleCount = options.peopleCount || 0;

		bodyContent += `
    <text:p text:style-name="CoverTitle">${title}</text:p>`;

		if (subtitle) {
			bodyContent += `
    <text:p text:style-name="CoverSubtitle">${subtitle}</text:p>`;
		}

		bodyContent += `
    <text:p text:style-name="CoverSpacer"/>`;

		if (rootPerson) {
			bodyContent += `
    <text:p text:style-name="CoverInfo">Root: ${rootPerson}</text:p>`;
		}

		bodyContent += `
    <text:p text:style-name="CoverInfo">${peopleCount} people</text:p>
    <text:p text:style-name="CoverInfo">Generated on ${date}</text:p>
    <text:p text:style-name="PageBreak"/>`;
	}

	// Chart image
	bodyContent += `
    <text:p text:style-name="ChartParagraph">
      <draw:frame draw:style-name="ChartFrame" draw:name="FamilyChart" text:anchor-type="paragraph" svg:width="${widthStr}" svg:height="${heightStr}">
        <draw:image xlink:href="Pictures/chart.png" xlink:type="simple" xlink:show="embed" xlink:actuate="onLoad"/>
      </draw:frame>
    </text:p>`;

	return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content
  xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
  xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0"
  xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
  xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"
  office:version="1.3">
  <office:automatic-styles>
    <style:style style:name="CoverTitle" style:family="paragraph">
      <style:paragraph-properties fo:text-align="center" fo:margin-top="8cm" fo:margin-bottom="0.5cm"/>
      <style:text-properties fo:font-size="28pt" fo:font-weight="bold"/>
    </style:style>
    <style:style style:name="CoverSubtitle" style:family="paragraph">
      <style:paragraph-properties fo:text-align="center" fo:margin-top="0.3cm" fo:margin-bottom="0.5cm"/>
      <style:text-properties fo:font-size="16pt" fo:color="#666666"/>
    </style:style>
    <style:style style:name="CoverSpacer" style:family="paragraph">
      <style:paragraph-properties fo:margin-top="4cm"/>
    </style:style>
    <style:style style:name="CoverInfo" style:family="paragraph">
      <style:paragraph-properties fo:text-align="center" fo:margin-top="0.2cm"/>
      <style:text-properties fo:font-size="12pt" fo:color="#888888"/>
    </style:style>
    <style:style style:name="PageBreak" style:family="paragraph">
      <style:paragraph-properties fo:break-after="page"/>
    </style:style>
    <style:style style:name="ChartParagraph" style:family="paragraph">
      <style:paragraph-properties fo:text-align="center"/>
    </style:style>
    <style:style style:name="ChartFrame" style:family="graphic">
      <style:graphic-properties style:horizontal-pos="center" style:horizontal-rel="paragraph"/>
    </style:style>
  </office:automatic-styles>
  <office:body>
    <office:text>${bodyContent}
    </office:text>
  </office:body>
</office:document-content>`;
}

/**
 * Generate styles.xml with page layout
 */
function generateStyles(): string {
	return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles
  xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
  xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"
  office:version="1.3">
  <office:automatic-styles>
    <style:page-layout style:name="pm1">
      <style:page-layout-properties fo:page-width="21cm" fo:page-height="29.7cm" fo:margin-top="2cm" fo:margin-bottom="2cm" fo:margin-left="2cm" fo:margin-right="2cm"/>
    </style:page-layout>
  </office:automatic-styles>
  <office:master-styles>
    <style:master-page style:name="Standard" style:page-layout-name="pm1"/>
  </office:master-styles>
</office:document-styles>`;
}

/**
 * Generate meta.xml with document metadata
 */
function generateMeta(title: string): string {
	const date = new Date().toISOString();
	return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-meta
  xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0"
  office:version="1.3">
  <office:meta>
    <dc:title>${escapeXml(title)}</dc:title>
    <dc:description>Family chart generated by Charted Roots</dc:description>
    <meta:generator>Charted Roots for Obsidian</meta:generator>
    <meta:creation-date>${date}</meta:creation-date>
    <dc:date>${date}</dc:date>
  </office:meta>
</office:document-meta>`;
}

/**
 * Escape special XML characters
 */
function escapeXml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}
