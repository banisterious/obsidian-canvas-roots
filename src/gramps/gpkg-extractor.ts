/**
 * Gramps Package (.gpkg) Extractor
 *
 * Handles extraction of .gpkg files which may be:
 * - ZIP archives containing data.gramps and media files
 * - Gzip-compressed tar archives (.tar.gz) containing data.gramps and media
 * - Gzip-compressed XML files (just the XML, no bundled media)
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
 * Check if a file is gzip compressed by checking magic bytes
 */
export function isGzipFile(data: ArrayBuffer): boolean {
	const view = new Uint8Array(data);
	// Gzip magic bytes: 0x1F 0x8B
	return view.length >= 2 && view[0] === 0x1f && view[1] === 0x8b;
}

/**
 * Check if data is gzip compressed by checking magic bytes
 */
function isGzipCompressed(data: Uint8Array): boolean {
	return data.length >= 2 && data[0] === 0x1f && data[1] === 0x8b;
}

/**
 * Decompress gzip data using native DecompressionStream
 * Returns the raw decompressed bytes
 */
async function decompressGzipToBytes(data: Uint8Array): Promise<Uint8Array> {
	if (typeof DecompressionStream === 'undefined') {
		throw new Error('DecompressionStream API not available. Cannot decompress gzip data.');
	}

	const ds = new DecompressionStream('gzip');
	const writer = ds.writable.getWriter();
	const reader = ds.readable.getReader();

	// Write compressed data and close writer
	// Must await these operations to signal completion to the reader
	await writer.write(data);
	await writer.close();

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

	// Combine chunks
	const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
	const combined = new Uint8Array(totalLength);
	let offset = 0;
	for (const chunk of chunks) {
		combined.set(chunk, offset);
		offset += chunk.length;
	}

	return combined;
}

/**
 * Decompress gzip data and return as UTF-8 string
 */
async function decompressGzip(data: Uint8Array): Promise<string> {
	const decompressed = await decompressGzipToBytes(data);
	return new TextDecoder('utf-8').decode(decompressed);
}

/**
 * Check if data is a tar archive by looking for tar file signature
 * Tar files have "ustar" at offset 257 in the header
 */
function isTarFile(data: Uint8Array): boolean {
	if (data.length < 263) return false;
	// Check for "ustar" magic at offset 257
	const magic = String.fromCharCode(data[257], data[258], data[259], data[260], data[261]);
	return magic === 'ustar';
}

/**
 * Extract files from a tar archive
 * Returns a map of filename to file content
 */
function extractTar(data: Uint8Array): Map<string, Uint8Array> {
	const files = new Map<string, Uint8Array>();
	let offset = 0;

	while (offset < data.length - 512) {
		// Read header (512 bytes)
		const header = data.slice(offset, offset + 512);

		// Check if we've reached the end (empty block)
		if (header.every(b => b === 0)) {
			break;
		}

		// Extract filename (first 100 bytes, null-terminated)
		let nameEnd = 0;
		while (nameEnd < 100 && header[nameEnd] !== 0) nameEnd++;
		const filename = new TextDecoder('utf-8').decode(header.slice(0, nameEnd));

		// Extract file size (bytes 124-135, octal string)
		let sizeStr = '';
		for (let i = 124; i < 136; i++) {
			if (header[i] === 0 || header[i] === 32) break;
			sizeStr += String.fromCharCode(header[i]);
		}
		const fileSize = parseInt(sizeStr.trim(), 8) || 0;

		// Extract file type (byte 156)
		const typeFlag = header[156];

		// Move past header
		offset += 512;

		// Only process regular files (typeFlag 0 or '0' which is 48)
		if ((typeFlag === 0 || typeFlag === 48) && fileSize > 0 && filename) {
			const fileData = data.slice(offset, offset + fileSize);
			files.set(filename, fileData);
		}

		// Move past file content (padded to 512-byte blocks)
		offset += Math.ceil(fileSize / 512) * 512;
	}

	return files;
}

/**
 * Extract contents of a .gpkg (Gramps Package) file
 *
 * Handles multiple formats:
 * - ZIP archives containing data.gramps and media files
 * - Gzip-compressed tar archives (.tar.gz) with data.gramps and media
 * - Gzip-compressed XML (no bundled media)
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

	const mediaFiles = new Map<string, ArrayBuffer>();

	// Check if it's a gzip-compressed file (not a ZIP)
	if (isGzipFile(data)) {
		logger.debug('extractGpkg', 'File is gzip compressed, decompressing...');
		const decompressed = await decompressGzipToBytes(new Uint8Array(data));

		// Check if the decompressed data is a tar archive
		if (isTarFile(decompressed)) {
			logger.debug('extractGpkg', 'Decompressed data is a tar archive, extracting...');
			const tarFiles = extractTar(decompressed);
			logger.debug('extractGpkg', `Tar contains ${tarFiles.size} entries: ${Array.from(tarFiles.keys()).slice(0, 20).join(', ')}${tarFiles.size > 20 ? '...' : ''}`);

			// Find the Gramps XML file in the tar
			let grampsXml: string | null = null;
			for (const [path, content] of tarFiles.entries()) {
				const lowerPath = path.toLowerCase();
				if (lowerPath.endsWith('.gramps') || lowerPath.endsWith('.xml')) {
					// Check if this file is also gzip compressed
					if (isGzipCompressed(content)) {
						logger.debug('extractGpkg', `Found gzip-compressed Gramps file in tar: ${path}`);
						grampsXml = await decompressGzip(content);
					} else {
						logger.debug('extractGpkg', `Found Gramps file in tar: ${path}`);
						grampsXml = new TextDecoder('utf-8').decode(content);
					}
				} else {
					// Check if it's a media file
					const isMediaFile = /\.(jpg|jpeg|png|gif|webp|bmp|tiff?|svg|pdf|doc|docx)$/i.test(path);
					if (isMediaFile) {
						mediaFiles.set(path, content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength));
						logger.debug('extractGpkg', `Extracted media file from tar: ${path}`);
					}
				}
			}

			if (!grampsXml) {
				throw new Error('No Gramps XML file found in tar archive');
			}

			logger.info('extractGpkg', `Tar extraction complete: ${mediaFiles.size} media files found`);
			return {
				grampsXml,
				mediaFiles,
				filename
			};
		}

		// Plain gzip-compressed XML (not a tar)
		const grampsXml = new TextDecoder('utf-8').decode(decompressed);
		logger.info('extractGpkg', 'Gzip-compressed .gpkg file - no bundled media');

		return {
			grampsXml,
			mediaFiles,
			filename
		};
	}

	// Check if it's a ZIP archive
	if (!isZipFile(data)) {
		throw new Error('File is not a valid ZIP or gzip archive');
	}

	// Load the ZIP
	const zip = await JSZip.loadAsync(data);

	// Log all files in the ZIP for debugging
	const allPaths = Object.keys(zip.files);
	logger.debug('extractGpkg', `ZIP contains ${allPaths.length} entries: ${allPaths.slice(0, 20).join(', ')}${allPaths.length > 20 ? '...' : ''}`);

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

	// Extract media files - any file with a media extension, regardless of directory
	for (const [path, file] of Object.entries(zip.files)) {
		// Skip directories and the Gramps XML file
		if (file.dir || path === grampsPath) {
			continue;
		}

		// Check if it's a media file by extension (anywhere in the archive)
		const isMediaFile = /\.(jpg|jpeg|png|gif|webp|bmp|tiff?|svg|pdf|doc|docx)$/i.test(path);

		if (isMediaFile) {
			const content = await file.async('arraybuffer');
			// Store with original path - the importer will handle path matching
			mediaFiles.set(path, content);
			logger.debug('extractGpkg', `Extracted media file: ${path}`);
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
