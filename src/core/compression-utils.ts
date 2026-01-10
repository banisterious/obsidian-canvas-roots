/**
 * Compression utilities for Charted Roots
 *
 * Handles gzip decompression for .gramps files and other compressed formats.
 */

import { getLogger } from './logging';

const logger = getLogger('CompressionUtils');

/**
 * Gzip magic number bytes (first two bytes of gzip files)
 */
const GZIP_MAGIC = [0x1f, 0x8b];

/**
 * Check if an ArrayBuffer contains gzip-compressed data
 * @param buffer The ArrayBuffer to check
 * @returns true if the buffer starts with gzip magic bytes
 */
export function isGzipCompressed(buffer: ArrayBuffer): boolean {
	const view = new Uint8Array(buffer);
	return view.length >= 2 && view[0] === GZIP_MAGIC[0] && view[1] === GZIP_MAGIC[1];
}

/**
 * Decompress a gzip-compressed ArrayBuffer to a string
 * Uses the browser's native DecompressionStream API
 *
 * @param compressedData The gzip-compressed data
 * @returns The decompressed string content
 * @throws Error if decompression fails
 */
export async function decompressGzip(compressedData: ArrayBuffer): Promise<string> {
	try {
		// Check if DecompressionStream is available (modern browsers)
		if (typeof DecompressionStream === 'undefined') {
			throw new Error('Gzip decompression is not supported in this environment. Please use an uncompressed XML file.');
		}

		logger.debug('decompressGzip', `Starting decompression of ${compressedData.byteLength} bytes`);

		// Create a decompression stream
		const ds = new DecompressionStream('gzip');

		// Create a readable stream from the compressed data
		const inputStream = new ReadableStream({
			start(controller) {
				controller.enqueue(new Uint8Array(compressedData));
				controller.close();
			}
		});

		// Pipe through the decompression stream
		const decompressedStream = inputStream.pipeThrough(ds);

		// Read all chunks into an array with timeout
		const reader = decompressedStream.getReader();
		const chunks: Uint8Array[] = [];

		// Create a promise that rejects after timeout
		const timeoutMs = 30000; // 30 seconds
		const timeoutPromise = new Promise<never>((_, reject) => {
			setTimeout(() => reject(new Error(`Decompression timed out after ${timeoutMs}ms`)), timeoutMs);
		});

		// Read decompressed data with timeout
		const readPromise = (async () => {
			let totalRead = 0;
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				chunks.push(value);
				totalRead += value.length;
			}
			logger.debug('decompressGzip', `Read ${chunks.length} chunks, total ${totalRead} bytes`);
			return chunks;
		})();

		// Wait for read to complete with timeout
		await Promise.race([readPromise, timeoutPromise]);

		// Combine chunks and decode as UTF-8
		const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
		const combined = new Uint8Array(totalLength);
		let offset = 0;
		for (const chunk of chunks) {
			combined.set(chunk, offset);
			offset += chunk.length;
		}

		const decoder = new TextDecoder('utf-8');
		const result = decoder.decode(combined);

		logger.debug('decompressGzip', `Decompression complete: ${compressedData.byteLength} -> ${result.length} characters`);

		return result;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		logger.error('decompressGzip', `Decompression failed: ${message}`);
		throw new Error(`Failed to decompress gzip data: ${message}`);
	}
}

/**
 * Read a File object and return its content as a string,
 * automatically decompressing if it's gzip-compressed
 *
 * @param file The File to read
 * @returns The file content as a string (decompressed if necessary)
 */
export async function readFileWithDecompression(file: File): Promise<string> {
	// First, read as ArrayBuffer to check for compression
	const buffer = await file.arrayBuffer();

	if (isGzipCompressed(buffer)) {
		logger.info('readFileWithDecompression', `File "${file.name}" is gzip-compressed, decompressing...`);
		return await decompressGzip(buffer);
	}

	// Not compressed, decode as UTF-8 text
	const decoder = new TextDecoder('utf-8');
	return decoder.decode(buffer);
}
