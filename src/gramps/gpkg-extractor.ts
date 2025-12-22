/**
 * Gramps Package (.gpkg) Extractor
 *
 * Handles extraction of .gpkg files which are ZIP archives containing:
 * - data.gramps (Gramps XML file, possibly gzip compressed)
 * - media/ directory with referenced media files
 */

import JSZip from 'jszip';
import { getLogger } from '../core/logging';

const logger = getLogger('GpkgExtractor');

/**
 * Result of extracting a .gpkg file
 */
export interface GpkgExtractionResult {
	/** The Gramps XML content (decompressed if necessary) */
	grampsXml: string;
	/** Map of media file paths (relative) to their binary content */
	mediaFiles: Map<string, ArrayBuffer>;
	/** Original filename for logging */
	filename: string;
}

/**
 * Check if a file is a ZIP archive by checking magic bytes
 */
export function isZipFile(data: ArrayBuffer): boolean {
	const view = new Uint8Array(data);
	// ZIP magic bytes: 0x50 0x4B (PK)
	return view.length >= 2 && view[0] === 0x50 && view[1] === 0x4B;
}

/**
 * Check if data is gzip compressed by checking magic bytes
 */
function isGzipCompressed(data: Uint8Array): boolean {
	return data.length >= 2 && data[0] === 0x1f && data[1] === 0x8b;
}

/**
 * Decompress gzip data using native DecompressionStream
 */
async function decompressGzip(data: Uint8Array): Promise<string> {
	if (typeof DecompressionStream === 'undefined') {
		throw new Error('DecompressionStream API not available. Cannot decompress gzip data.');
	}

	const ds = new DecompressionStream('gzip');
	const writer = ds.writable.getWriter();
	const reader = ds.readable.getReader();

	// Write compressed data
	writer.write(data);
	writer.close();

	// Read decompressed data
	const chunks: Uint8Array[] = [];
	let done = false;
	while (!done) {
		const { value, done: readerDone } = await reader.read();
		if (value) {
			chunks.push(value);
		}
		done = readerDone;
	}

	// Combine chunks and decode as UTF-8
	const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
	const combined = new Uint8Array(totalLength);
	let offset = 0;
	for (const chunk of chunks) {
		combined.set(chunk, offset);
		offset += chunk.length;
	}

	return new TextDecoder('utf-8').decode(combined);
}

/**
 * Extract contents of a .gpkg (Gramps Package) file
 *
 * @param data - The raw file data as ArrayBuffer
 * @param filename - Original filename for logging
 * @returns Extraction result with XML content and media files
 */
export async function extractGpkg(
	data: ArrayBuffer,
	filename: string
): Promise<GpkgExtractionResult> {
	logger.info('extractGpkg', `Starting extraction of ${filename}`);

	// Verify it's a ZIP file
	if (!isZipFile(data)) {
		throw new Error('File is not a valid ZIP archive');
	}

	// Load the ZIP
	const zip = await JSZip.loadAsync(data);

	// Find the Gramps XML file
	// It's typically named data.gramps or [filename].gramps at the root
	let grampsFile: JSZip.JSZipObject | null = null;
	let grampsPath = '';

	for (const path of Object.keys(zip.files)) {
		const lowerPath = path.toLowerCase();
		if (lowerPath.endsWith('.gramps') || lowerPath.endsWith('.xml')) {
			// Prefer files at root level or named data.gramps
			if (!grampsFile || lowerPath === 'data.gramps' || !path.includes('/')) {
				grampsFile = zip.files[path];
				grampsPath = path;
			}
		}
	}

	if (!grampsFile) {
		throw new Error('No Gramps XML file found in package. Expected .gramps or .xml file.');
	}

	logger.debug('extractGpkg', `Found Gramps file: ${grampsPath}`);

	// Extract and decompress the Gramps XML
	const grampsData = await grampsFile.async('uint8array');
	let grampsXml: string;

	if (isGzipCompressed(grampsData)) {
		logger.debug('extractGpkg', 'Gramps file is gzip compressed, decompressing...');
		grampsXml = await decompressGzip(grampsData);
	} else {
		grampsXml = new TextDecoder('utf-8').decode(grampsData);
	}

	// Extract media files
	const mediaFiles = new Map<string, ArrayBuffer>();
	const mediaPrefix = 'media/';

	for (const [path, file] of Object.entries(zip.files)) {
		// Skip directories and the Gramps XML file
		if (file.dir || path === grampsPath) {
			continue;
		}

		// Check if it's in the media folder or is a media file at root
		const isMediaPath = path.toLowerCase().startsWith(mediaPrefix);
		const isMediaFile = /\.(jpg|jpeg|png|gif|webp|bmp|tiff?|svg|pdf|doc|docx)$/i.test(path);

		if (isMediaPath || isMediaFile) {
			const content = await file.async('arraybuffer');
			// Store with normalized path (remove media/ prefix if present)
			const normalizedPath = isMediaPath ? path.substring(mediaPrefix.length) : path;
			mediaFiles.set(normalizedPath, content);
			logger.debug('extractGpkg', `Extracted media file: ${normalizedPath}`);
		}
	}

	logger.info('extractGpkg', `Extraction complete: ${mediaFiles.size} media files found`);

	return {
		grampsXml,
		mediaFiles,
		filename
	};
}

/**
 * Get media file extension from path
 */
export function getMediaExtension(path: string): string {
	const lastDot = path.lastIndexOf('.');
	if (lastDot === -1) return '';
	return path.substring(lastDot + 1).toLowerCase();
}

/**
 * Get media MIME type from extension
 */
export function getMediaMimeType(extension: string): string {
	const mimeTypes: Record<string, string> = {
		'jpg': 'image/jpeg',
		'jpeg': 'image/jpeg',
		'png': 'image/png',
		'gif': 'image/gif',
		'webp': 'image/webp',
		'bmp': 'image/bmp',
		'tif': 'image/tiff',
		'tiff': 'image/tiff',
		'svg': 'image/svg+xml',
		'pdf': 'application/pdf',
		'doc': 'application/msword',
		'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
	};
	return mimeTypes[extension] || 'application/octet-stream';
}
