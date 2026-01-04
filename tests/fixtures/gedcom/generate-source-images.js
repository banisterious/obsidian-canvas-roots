#!/usr/bin/env node
/**
 * Generate test source images and a GEDCOM file with source references.
 *
 * Usage: node generate-source-images.js [output-dir]
 *
 * Creates:
 *   - source-images/ directory with test images (minimal valid JPEGs)
 *   - gedcom-sample-medium-sources.ged with source references
 */

const fs = require('fs');
const path = require('path');

// Configuration
const OUTPUT_DIR = process.argv[2] || 'source-images';
const GEDCOM_OUTPUT = 'gedcom-sample-medium-sources.ged';

// Surnames from the medium GEDCOM (mapped to test naming convention)
const SURNAMES = [
    'anderson', 'obrien', 'henderson', 'schmidt', 'martinez', 'garcia',
    'thompson', 'wilson', 'nguyen', 'johnson', 'cooper', 'kim', 'davis',
    'lee', 'taylor', 'brown', 'clark', 'white', 'robinson', 'harris',
    'turner', 'foster', 'miller', 'green', 'mitchell'
];

// Record types with their GEDCOM event mappings
const RECORD_TYPES = {
    census: ['RESI', 'CENS'],
    birth_record: ['BIRT'],
    marriage_record: ['MARR'],
    death_record: ['DEAT'],
    military: ['MILI'],
    immigration: ['IMMI'],
    obit: ['DEAT']
};

// US State codes
const STATES = ['IL', 'MA', 'TX', 'FL', 'CA', 'OH', 'MI', 'GA', 'AZ', 'WA', 'OR', 'TN', 'CO', 'MN', 'NC'];

// Census years
const CENSUS_YEARS = [1850, 1860, 1870, 1880, 1900, 1910, 1920, 1930, 1940];

// Individuals from medium GEDCOM (simplified for reference)
const INDIVIDUALS = [
    { id: 'I1', given: 'William', surname: 'Anderson', byear: 1905, dyear: 1982 },
    { id: 'I2', given: 'Margaret', surname: 'OBrien', byear: 1908, dyear: 1995 },
    { id: 'I3', given: 'Charles', surname: 'Henderson', byear: 1910, dyear: 1988 },
    { id: 'I4', given: 'Dorothy', surname: 'Schmidt', byear: 1912, dyear: 1998 },
    { id: 'I5', given: 'George', surname: 'Martinez', byear: 1915, dyear: 1992 },
    { id: 'I6', given: 'Rosa', surname: 'Garcia', byear: 1918, dyear: 2005 },
    { id: 'I7', given: 'Robert', surname: 'Anderson', byear: 1930, dyear: 2015 },
    { id: 'I8', given: 'Helen', surname: 'Henderson', byear: 1932, dyear: 1968 },
    { id: 'I9', given: 'Patricia', surname: 'Henderson', byear: 1935 },
    { id: 'I10', given: 'David', surname: 'Martinez', byear: 1938 },
    { id: 'I11', given: 'Maria', surname: 'Martinez', byear: 1940 },
    { id: 'I12', given: 'Susan', surname: 'Anderson', byear: 1933 },
    { id: 'I13', given: 'Catherine', surname: 'Thompson', byear: 1942 },
    { id: 'I14', given: 'Thomas', surname: 'Wilson', byear: 1934 },
    { id: 'I15', given: 'Linda', surname: 'Nguyen', byear: 1940 },
    { id: 'I16', given: 'James', surname: 'Johnson', byear: 1938 },
    { id: 'I17', given: 'Richard', surname: 'Cooper', byear: 1931 },
    { id: 'I18', given: 'Michael', surname: 'Anderson', byear: 1955 },
    { id: 'I19', given: 'Jennifer', surname: 'Anderson', byear: 1957 },
    { id: 'I20', given: 'Karen', surname: 'Anderson', byear: 1959 },
];

/**
 * Generate a test image filename based on pattern
 */
function generateFilename(pattern, data) {
    const { surname, given, byear, year, type, state, part } = data;

    switch (pattern) {
        case 'surname_year_type':
            return `${surname}_${year}_${type}.jpg`;

        case 'surname_given_byear_year_place_type':
            return `${surname}_${given}_b${byear}_${year}_USA_${state}_${type}.jpg`;

        case 'surname_given_byear_type':
            return `${surname}_${given}_b${byear}_${type}.jpg`;

        case 'surname_given_byear_type_part':
            return `${surname}_${given}_b${byear}_${type}_${part}.jpg`;

        case 'multi_family':
            return `${surname}_and_${data.surname2}_various_${year}_USA_${state}_census.jpg`;

        case 'passenger_list':
            return `ss_${data.shipName}_pas_list_${year}-${data.month}-${data.day}.jpg`;

        case 'descriptive':
            return `${data.description}.jpg`;

        default:
            return `${surname}_${year}_${type}.jpg`;
    }
}

/**
 * Create a placeholder image (1x1 pixel JPEG)
 * This creates minimal valid JPEG files for testing without requiring ImageMagick
 */
function createImage(filename, label, outputDir) {
    const filepath = path.join(outputDir, filename);

    // Minimal valid JPEG (1x1 gray pixel)
    // This is a valid JPEG that any image viewer can open
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
 * Generate source records for GEDCOM
 */
function generateSourceRecords(images) {
    const sources = [];
    let sourceId = 1;

    for (const img of images) {
        sources.push({
            id: `S${sourceId}`,
            title: img.title,
            file: img.filename,
            type: img.type,
            year: img.year,
            individuals: img.individuals || []
        });
        sourceId++;
    }

    return sources;
}

/**
 * Build GEDCOM file content with sources
 */
function buildGedcom(sources, baseGedcomPath) {
    // Read base GEDCOM
    const baseContent = fs.readFileSync(baseGedcomPath, 'utf-8');
    const lines = baseContent.split('\n');

    // Find where to insert sources (before TRLR)
    const trlrIndex = lines.findIndex(l => l.trim() === '0 TRLR');

    // Build source records
    const sourceLines = [];
    for (const src of sources) {
        sourceLines.push(`0 @${src.id}@ SOUR`);
        sourceLines.push(`1 TITL ${src.title}`);
        sourceLines.push(`1 FILE ${src.file}`);
        if (src.year) {
            sourceLines.push(`1 DATE ${src.year}`);
        }
        sourceLines.push(`1 TEXT Test source image for bulk import testing`);
    }

    // Insert sources before TRLR
    const newLines = [
        ...lines.slice(0, trlrIndex),
        ...sourceLines,
        ...lines.slice(trlrIndex)
    ];

    // Update header
    const headerIndex = newLines.findIndex(l => l.includes('SOUR Canvas Roots'));
    if (headerIndex >= 0) {
        newLines[headerIndex + 1] = '2 VERS 1.0';
        newLines[headerIndex + 2] = '2 NAME Canvas Roots Medium Test - With Sources';
    }

    return newLines.join('\n');
}

/**
 * Messy filename templates - realistic variations seen in real collections
 */
const MESSY_PATTERNS = [
    // Mixed case variations
    { template: (s, g, y, t) => `${s}_${y}_${t}.jpg`, desc: 'lowercase_year_type' },
    { template: (s, g, y, t) => `${s.toUpperCase()}_${y}_${t}.JPG`, desc: 'UPPERCASE_year_type' },
    { template: (s, g, y, t) => `${capitalize(s)}_${y}_${capitalize(t)}.jpg`, desc: 'Capitalized_Year_Type' },

    // Separator variations
    { template: (s, g, y, t) => `${s}-${g}-${y}-${t}.jpg`, desc: 'hyphen-separated' },
    { template: (s, g, y, t) => `${s} ${g} ${y} ${t}.jpg`, desc: 'space separated' },
    { template: (s, g, y, t) => `${s}.${g}.${y}.${t}.jpg`, desc: 'dot.separated' },
    { template: (s, g, y, t) => `${s}_${g}_${y}_${t}.jpeg`, desc: 'jpeg extension' },

    // Abbreviations and typos
    { template: (s, g, y, t) => `${s}_${g.slice(0, 2)}_${y}_cens.jpg`, desc: 'abbreviated' },
    { template: (s, g, y, t) => `${s.slice(0, -1)}_${g}_${y}_${t}.jpg`, desc: 'typo in surname' },

    // Scanner/camera naming
    { template: (s, g, y, t) => `scan${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}.jpg`, desc: 'scanner naming' },
    { template: (s, g, y, t) => `IMG_${Date.now() % 100000000}.jpg`, desc: 'camera naming' },
    { template: (s, g, y, t) => `Document${Math.floor(Math.random() * 99) + 1}.jpg`, desc: 'generic document' },

    // Extra noise/suffixes
    { template: (s, g, y, t) => `${s}_${g}_${y}_${t}_FINAL.jpg`, desc: 'with FINAL suffix' },
    { template: (s, g, y, t) => `${s}_${g}_${y}_${t}_v2.jpg`, desc: 'with version' },
    { template: (s, g, y, t) => `${s}_${g}_${y}_${t}_edited.jpg`, desc: 'with edited suffix' },
    { template: (s, g, y, t) => `${s}_${g}_${y}_${t}_cropped.jpg`, desc: 'with cropped suffix' },
    { template: (s, g, y, t) => `${s}_${g}_${y}_${t} (1).jpg`, desc: 'with copy number' },

    // Date format variations
    { template: (s, g, y, t) => `${t}_${y}_${s}.jpg`, desc: 'type_year_surname order' },
    { template: (s, g, y, t) => `${y}-${s}-${t}.jpg`, desc: 'year first' },

    // Partial information
    { template: (s, g, y, t) => `${t}_page_${Math.floor(Math.random() * 10) + 1}.jpg`, desc: 'type and page only' },
    { template: (s, g, y, t) => `${s}_family.jpg`, desc: 'surname only' },
    { template: (s, g, y, t) => `${y}_${t}.jpg`, desc: 'year and type only' },

    // Descriptive/sentence style
    { template: (s, g, y, t) => `${capitalize(t)} for ${capitalize(s)} Family - ${y}.jpg`, desc: 'sentence style' },
    { template: (s, g, y, t) => `${capitalize(g)} ${capitalize(s)} - ${capitalize(t)} ${y}.jpg`, desc: 'name dash type year' },

    // Multi-part variations
    { template: (s, g, y, t) => `${s}_${g}_${y}_${t}_p1.jpg`, desc: 'page 1' },
    { template: (s, g, y, t) => `${s}_${g}_${y}_${t}_p2.jpg`, desc: 'page 2' },
    { template: (s, g, y, t) => `${s}_${g}_${y}_${t}_01.jpg`, desc: 'numbered 01' },
    { template: (s, g, y, t) => `${s}_${g}_${y}_${t}_02.jpg`, desc: 'numbered 02' },

    // Uncertainty markers
    { template: (s, g, y, t) => `${s}_${g}_${y}_${t}_maybe.jpg`, desc: 'maybe suffix' },
    { template: (s, g, y, t) => `${s}_${g}_${y}_${t}_unverified.jpg`, desc: 'unverified' },
    { template: (s, g, y, t) => `${s}_${g}_${y}_${t}_questionable.jpg`, desc: 'questionable' },
];

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Main execution
 */
function main() {
    console.log('Generating messy test source images and GEDCOM...\n');

    // Create output directory
    const outputDir = path.join(__dirname, OUTPUT_DIR);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const images = [];
    let fileIndex = 0;

    // ============================================================
    // WELL-FORMED FILES (minority - about 20%)
    // These represent files that already follow good naming conventions
    // ============================================================
    console.log('Generating well-formed files (baseline)...');

    // A few clean, well-structured census records
    for (const ind of INDIVIDUALS.slice(0, 3)) {
        const year = CENSUS_YEARS.find(y => y > ind.byear && y <= (ind.dyear || 2000)) || 1940;
        const state = STATES[fileIndex % STATES.length];
        const filename = `${ind.surname.toLowerCase()}_${ind.given.toLowerCase()}_b${ind.byear}_${year}_USA_${state}_census.jpg`;

        if (createImage(filename, '', outputDir)) {
            images.push({
                filename,
                title: `${year} Census - ${ind.given} ${ind.surname}`,
                type: 'census',
                year,
                individuals: [ind.id]
            });
            fileIndex++;
        }
    }

    // ============================================================
    // MESSY FILES (majority - about 80%)
    // These represent the chaos of real-world collections
    // ============================================================
    console.log('Generating messy/inconsistent files...');

    // Mixed case census records
    const ind1 = INDIVIDUALS[3];
    const messyCensus = [
        `${ind1.surname.toUpperCase()}_1920_Census.JPG`,
        `Henderson-Charles-1920-census.jpg`,
        `SCHMIDT dorothy 1920 census.jpg`,
        `Martinez_George_1920_CENSUS_final.jpg`,
    ];
    for (const filename of messyCensus) {
        if (createImage(filename, '', outputDir)) {
            images.push({
                filename,
                title: '1920 Census',
                type: 'census',
                year: 1920,
                individuals: []
            });
        }
    }

    // Scanner/camera auto-named files (common in real collections)
    console.log('Generating scanner/camera named files...');
    const scannerFiles = [
        'scan0001.jpg',
        'scan0002.jpg',
        'scan0047.jpg',
        'IMG_20231215_143022.jpg',
        'IMG_20231215_143156.jpg',
        'Document1.jpg',
        'Document2.jpg',
        'Photo 2023-12-15 at 2.45 PM.jpg',
        'Scan 12-15-2023.jpg',
    ];
    for (const filename of scannerFiles) {
        if (createImage(filename, '', outputDir)) {
            images.push({
                filename,
                title: 'Unknown document',
                type: 'unknown',
                individuals: []
            });
        }
    }

    // Birth records with various formats
    console.log('Generating birth records (various formats)...');
    const birthFiles = [
        'anderson_william_birth_1905.jpg',
        'Birth Certificate - Margaret OBrien 1908.jpg',
        'obrien-margaret-b1908-birth_record.jpeg',
        'HENDERSON_CHARLES_BIRTH.JPG',
        'schmidt dorothy birth record 1912.jpg',
        'birth_cert_martinez_george.jpg',
    ];
    for (const filename of birthFiles) {
        if (createImage(filename, '', outputDir)) {
            images.push({
                filename,
                title: 'Birth Record',
                type: 'birth_record',
                individuals: []
            });
        }
    }

    // Marriage records with inconsistent naming
    console.log('Generating marriage records...');
    const marriageFiles = [
        'anderson_and_obrien_marriage_1928.jpg',
        'Marriage - William Anderson & Margaret OBrien.jpg',
        'henderson-schmidt-wedding-1931.jpg',
        'MARTINEZ_GARCIA_MARRIAGE_LICENSE.JPG',
        'marriage_cert_wilson_henderson_1958.jpg',
    ];
    for (const filename of marriageFiles) {
        if (createImage(filename, '', outputDir)) {
            images.push({
                filename,
                title: 'Marriage Record',
                type: 'marriage_record',
                individuals: []
            });
        }
    }

    // Death records and obituaries
    console.log('Generating death records and obituaries...');
    const deathFiles = [
        'anderson_william_obit_1982.jpg',
        'Obituary - William Anderson - Miami Herald 1982.jpg',
        'obrien_margaret_death_certificate.jpg',
        'henderson-charles-obit.jpeg',
        'Death Certificate for Dorothy Schmidt 1998.jpg',
        'martinez_george_obituary_1992_houston_chronicle.jpg',
    ];
    for (const filename of deathFiles) {
        if (createImage(filename, '', outputDir)) {
            images.push({
                filename,
                title: 'Death Record/Obituary',
                type: 'obit',
                individuals: []
            });
        }
    }

    // Military records
    console.log('Generating military records...');
    const militaryFiles = [
        'anderson_william_wwii_draft_card.jpg',
        'WWI Draft Registration - Charles Henderson.jpg',
        'martinez-george-wwii-draft-1942.jpeg',
        'draft_registration_henderson_charles_1917.jpg',
        'WWII_DRAFT_ANDERSON_WILLIAM.JPG',
    ];
    for (const filename of militaryFiles) {
        if (createImage(filename, '', outputDir)) {
            images.push({
                filename,
                title: 'Military Record',
                type: 'military',
                individuals: []
            });
        }
    }

    // Multi-part document sets (census pages, etc.)
    console.log('Generating multi-part documents...');
    const multiPartFiles = [
        // Set 1: underscore numbered
        'anderson_1930_census_p1.jpg',
        'anderson_1930_census_p2.jpg',
        // Set 2: lettered
        'henderson_1920_census_a.jpg',
        'henderson_1920_census_b.jpg',
        'henderson_1920_census_c.jpg',
        // Set 3: dash numbered
        'martinez-1940-census-01.jpg',
        'martinez-1940-census-02.jpg',
        // Set 4: page spelled out
        'schmidt_1930_census_page1.jpg',
        'schmidt_1930_census_page2.jpg',
        // Set 5: inconsistent within set (realistic!)
        'wilson_census_1920_partA.jpg',
        'wilson_census_1920-part-B.jpg',
        'Wilson Census 1920 Part C.jpg',
    ];
    for (const filename of multiPartFiles) {
        if (createImage(filename, '', outputDir)) {
            images.push({
                filename,
                title: 'Census (multi-part)',
                type: 'census',
                individuals: []
            });
        }
    }

    // Passenger lists / immigration
    console.log('Generating immigration records...');
    const immigrationFiles = [
        'ss_queen_mary_passenger_list_1936.jpg',
        'Ellis Island - OBrien Margaret 1908.jpg',
        'passenger_manifest_1918_garcia_rosa.jpg',
        'immigration-nguyen-linda-1965.jpeg',
    ];
    for (const filename of immigrationFiles) {
        if (createImage(filename, '', outputDir)) {
            images.push({
                filename,
                title: 'Immigration Record',
                type: 'immigration',
                individuals: []
            });
        }
    }

    // Cemetery/burial records
    console.log('Generating cemetery records...');
    const cemeteryFiles = [
        'Cemetery Record for Florida - Anderson Family Plot.jpg',
        'gravestone_henderson_charles.jpg',
        'Miami Memorial Park - Anderson William 1982.jpg',
        'Burial Record - Schmidt Dorothy.jpg',
    ];
    for (const filename of cemeteryFiles) {
        if (createImage(filename, '', outputDir)) {
            images.push({
                filename,
                title: 'Cemetery Record',
                type: 'cemetery',
                individuals: []
            });
        }
    }

    // Files with uncertainty markers
    console.log('Generating files with uncertainty markers...');
    const uncertainFiles = [
        'martinez_george_1915_census_maybe.jpg',
        'henderson_1910_census_unverified.jpg',
        'anderson_birth_possibly_wrong_date.jpg',
        'wilson_thomas_census_questionable.jpg',
    ];
    for (const filename of uncertainFiles) {
        if (createImage(filename, '', outputDir)) {
            images.push({
                filename,
                title: 'Uncertain Record',
                type: 'census',
                individuals: []
            });
        }
    }

    // Files with version/edit suffixes
    console.log('Generating files with edit suffixes...');
    const editedFiles = [
        'anderson_1930_census_FINAL.jpg',
        'henderson_birth_v2.jpg',
        'martinez_obit_edited.jpg',
        'schmidt_census_cropped.jpg',
        'wilson_marriage (1).jpg',
        'wilson_marriage (2).jpg',
        'garcia_census_enhanced_contrast.jpg',
    ];
    for (const filename of editedFiles) {
        if (createImage(filename, '', outputDir)) {
            images.push({
                filename,
                title: 'Edited Record',
                type: 'unknown',
                individuals: []
            });
        }
    }

    // Thumbnails (should be filtered out)
    console.log('Generating thumbnails (for filter testing)...');
    const thumbnailFiles = [
        'thumb_anderson_1930_census.jpg',
        'thumb_henderson_birth.jpg',
        'thumbnail_martinez_obit.jpg',
        '.anderson_census_1920.jpg',  // hidden file
    ];
    for (const filename of thumbnailFiles) {
        createImage(filename, '', outputDir);
        // Don't add to images array - these should be filtered
    }

    // Non-image files (for filter testing)
    console.log('Generating non-image files (for filter testing)...');
    fs.writeFileSync(path.join(outputDir, 'notes.txt'), 'These are my genealogy notes');
    fs.writeFileSync(path.join(outputDir, 'research_log.doc'), 'Research log placeholder');
    fs.writeFileSync(path.join(outputDir, 'family_tree.pdf'), 'PDF placeholder');

    // Generate GEDCOM
    console.log('\nGenerating GEDCOM with source references...');
    const sources = generateSourceRecords(images);
    const baseGedcom = path.join(__dirname, 'gedcom-sample-medium.ged');
    const gedcomContent = buildGedcom(sources, baseGedcom);

    const gedcomPath = path.join(__dirname, GEDCOM_OUTPUT);
    fs.writeFileSync(gedcomPath, gedcomContent);

    // Summary
    console.log('\n--- Summary ---');
    console.log(`Total images created: ${images.length}`);
    console.log(`Output directory: ${outputDir}`);
    console.log(`GEDCOM file: ${GEDCOM_OUTPUT}`);
    console.log(`Sources in GEDCOM: ${sources.length}`);

    console.log('\nMessy patterns included:');
    console.log('  - Mixed case (lowercase, UPPERCASE, Capitalized)');
    console.log('  - Different separators (underscore, hyphen, space, dot)');
    console.log('  - Different extensions (.jpg, .jpeg, .JPG)');
    console.log('  - Scanner/camera auto-names (scan0001, IMG_*, Document*)');
    console.log('  - Abbreviations and typos');
    console.log('  - Extra suffixes (_FINAL, _v2, _edited, _cropped)');
    console.log('  - Copy numbers ((1), (2))');
    console.log('  - Various date/field ordering');
    console.log('  - Partial information (surname only, year+type only)');
    console.log('  - Sentence-style descriptive names');
    console.log('  - Multi-part variations (_p1, _a, _01, _page1)');
    console.log('  - Uncertainty markers (_maybe, _unverified, _questionable)');
    console.log('  - Inconsistent naming within multi-part sets');
    console.log('  - Thumbnails and hidden files (for filter testing)');
    console.log('  - Non-image files (.txt, .doc, .pdf for filter testing)');
}

main();
