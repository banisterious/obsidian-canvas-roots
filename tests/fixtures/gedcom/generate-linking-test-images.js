#!/usr/bin/env node
/**
 * Generate test images for the "link media to existing sources" feature.
 * These images correspond to the 16 source records (S70-S85) in gedcom-sample-medium-sources.ged
 * that were added WITHOUT FILE references.
 *
 * Usage: node generate-linking-test-images.js [output-dir]
 */

const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = process.argv[2] || 'linking-test-images';

/**
 * Create a placeholder image (1x1 pixel JPEG)
 * This creates minimal valid JPEG files for testing without requiring ImageMagick
 */
function createImage(filename, outputDir) {
    const filepath = path.join(outputDir, filename);

    // Minimal valid JPEG (1x1 gray pixel)
    const minimalJpeg = Buffer.from([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
        0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
        0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
        0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
        0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
        0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
        0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
        0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
        0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00,
        0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
        0x09, 0x0A, 0x0B, 0xFF, 0xC4, 0x00, 0xB5, 0x10, 0x00, 0x02, 0x01, 0x03,
        0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7D,
        0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06,
        0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xA1, 0x08,
        0x23, 0x42, 0xB1, 0xC1, 0x15, 0x52, 0xD1, 0xF0, 0x24, 0x33, 0x62, 0x72,
        0x82, 0x09, 0x0A, 0x16, 0x17, 0x18, 0x19, 0x1A, 0x25, 0x26, 0x27, 0x28,
        0x29, 0x2A, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3A, 0x43, 0x44, 0x45,
        0x46, 0x47, 0x48, 0x49, 0x4A, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59,
        0x5A, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6A, 0x73, 0x74, 0x75,
        0x76, 0x77, 0x78, 0x79, 0x7A, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
        0x8A, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9A, 0xA2, 0xA3,
        0xA4, 0xA5, 0xA6, 0xA7, 0xA8, 0xA9, 0xAA, 0xB2, 0xB3, 0xB4, 0xB5, 0xB6,
        0xB7, 0xB8, 0xB9, 0xBA, 0xC2, 0xC3, 0xC4, 0xC5, 0xC6, 0xC7, 0xC8, 0xC9,
        0xCA, 0xD2, 0xD3, 0xD4, 0xD5, 0xD6, 0xD7, 0xD8, 0xD9, 0xDA, 0xE1, 0xE2,
        0xE3, 0xE4, 0xE5, 0xE6, 0xE7, 0xE8, 0xE9, 0xEA, 0xF1, 0xF2, 0xF3, 0xF4,
        0xF5, 0xF6, 0xF7, 0xF8, 0xF9, 0xFA, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01,
        0x00, 0x00, 0x3F, 0x00, 0xFB, 0xD5, 0xDB, 0x20, 0xA8, 0xF1, 0x7E, 0xA8,
        0xA0, 0x0F, 0xFF, 0xD9
    ]);

    try {
        fs.writeFileSync(filepath, minimalJpeg);
        return true;
    } catch (err) {
        console.error(`Failed to create image: ${filename}`);
        console.error(`  Error: ${err.message}`);
        return false;
    }
}

/**
 * Images corresponding to sources S70-S85 in gedcom-sample-medium-sources.ged
 * These sources exist WITHOUT FILE references, so these images can be used
 * to test the "link media to existing sources" feature.
 *
 * MIX OF DIFFICULTY LEVELS:
 * - Some have enough clues for suggestions (surname, year, type keywords)
 * - Some are genuinely hard (scanner names, timestamps) requiring manual selection
 */
const LINKING_TEST_IMAGES = [
    // S70: 1880 Census - Anderson Family (Cook County, IL)
    // MATCHABLE: Has surname + year + type keyword
    { filename: 'anderson_census_1880.jpg', sourceId: 'S70', title: '1880 Census - Anderson Family' },

    // S71: 1900 Census - Henderson Family (Harris County, TX)
    // MATCHABLE: Has surname + year
    { filename: 'henderson_1900_texas.jpg', sourceId: 'S71', title: '1900 Census - Henderson Family' },

    // S72: Marriage Record - Anderson/Murphy (Boston, MA, 1875)
    // MATCHABLE: Has type keyword + location
    { filename: 'Marriage Cert Boston 1875.jpeg', sourceId: 'S72', title: 'Marriage Record - Anderson/Murphy' },

    // S73: Birth Record - Dorothy Schmidt (Milwaukee, WI, 1912)
    // MATCHABLE: Has surname + type + year
    { filename: 'schmidt_birth_1912.jpg', sourceId: 'S73', title: 'Birth Record - Dorothy Schmidt' },

    // S74: Family Bible - Martinez Family
    // PARTIALLY MATCHABLE: Has surname
    { filename: 'martinez_bible_pages.jpg', sourceId: 'S74', title: 'Family Bible - Martinez Family' },

    // S75: Obituary - Sarah Henderson (Chicago Tribune, 1945)
    // MATCHABLE: Has surname + type keyword + year
    { filename: 'henderson_obituary_1945.jpg', sourceId: 'S75', title: 'Obituary - Sarah Henderson' },

    // S76: Immigration Record - OBrien Family (Ellis Island, 1905)
    // HARD: Generic document name - requires manual selection
    { filename: 'Document (3).jpg', sourceId: 'S76', title: 'Immigration Record - OBrien Family' },

    // S77: Land Deed - Anderson Property (Miami-Dade County, FL, 1910)
    // PARTIALLY MATCHABLE: Has location clue
    { filename: 'deed_miami_1910.jpg', sourceId: 'S77', title: 'Land Deed - Anderson Property' },

    // S78: WWI Draft Registration - George Martinez (1917)
    // MATCHABLE: Has surname + type keyword
    { filename: 'martinez_wwi_draft.jpg', sourceId: 'S78', title: 'WWI Draft Registration - George Martinez' },

    // S79: Baptism Record - Charles Henderson (St. Patrick's Church, Chicago, 1910)
    // PARTIALLY MATCHABLE: Has location clue
    { filename: 'st_patricks_chicago_1910.jpg', sourceId: 'S79', title: 'Baptism Record - Charles Henderson' },

    // S80: Probate Record - Patrick Anderson Estate (1920)
    // HARD: Very generic - requires manual selection
    { filename: 'courthouse document.jpeg', sourceId: 'S80', title: 'Probate Record - Patrick Anderson Estate' },

    // S81: Cemetery Record - Anderson Plot (Woodlawn Cemetery, Miami)
    // MATCHABLE: Has location + type clue
    { filename: 'woodlawn_cemetery_miami.jpg', sourceId: 'S81', title: 'Cemetery Record - Anderson Plot' },

    // S82: 1930 Census - Schmidt Family (Milwaukee, WI)
    // MATCHABLE: Has surname + year + type
    { filename: 'schmidt_1930_census.jpg', sourceId: 'S82', title: '1930 Census - Schmidt Family' },

    // S83: Marriage Record - Henderson/Schmidt (1931)
    // MATCHABLE: Has surnames + type keyword
    { filename: 'henderson_schmidt_marriage.jpg', sourceId: 'S83', title: 'Marriage Record - Henderson/Schmidt' },

    // S84: Social Security Death Index - William Anderson (1982)
    // HARD: Abbreviation only - requires manual selection
    { filename: 'ssdi_record_1982.jpg', sourceId: 'S84', title: 'SSDI - William Anderson' },

    // S85: Oral History Recording Transcript - Maria Martinez (2020)
    // HARD: Voice memo style - requires manual selection
    { filename: 'Voice Memo 2020-03-15.jpg', sourceId: 'S85', title: 'Oral History - Maria Martinez' },
];

function main() {
    console.log('Generating test images for "link to existing sources" feature...\n');

    // Create output directory
    const outputDir = path.join(__dirname, OUTPUT_DIR);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    let successCount = 0;
    for (const img of LINKING_TEST_IMAGES) {
        if (createImage(img.filename, outputDir)) {
            console.log(`  Created: ${img.filename}`);
            console.log(`           -> Matches ${img.sourceId}: ${img.title}`);
            successCount++;
        }
    }

    console.log('\n--- Summary ---');
    console.log(`Images created: ${successCount}/${LINKING_TEST_IMAGES.length}`);
    console.log(`Output directory: ${outputDir}`);
    console.log('\nThese images correspond to sources S70-S85 in gedcom-sample-medium-sources.ged');
    console.log('which exist WITHOUT FILE references. Use them to test the "link media to');
    console.log('existing sources" wizard feature.');
}

main();
