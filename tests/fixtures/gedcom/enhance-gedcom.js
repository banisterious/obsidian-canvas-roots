/**
 * Script to enhance GEDCOM files with sources and more detailed places
 * Run with: node enhance-gedcom.js input.ged output.ged
 */

const fs = require('fs');

// Source definitions to add
const SOURCES = [
    { id: '@S1@', title: 'Family Bible', auth: 'Family records', publ: 'Private collection', text: 'Contains birth, death, and marriage records passed down through generations.' },
    { id: '@S2@', title: 'State Vital Records', auth: 'State Department of Health', publ: 'State Archives', text: 'Official birth, death, and marriage certificates.' },
    { id: '@S3@', title: 'U.S. Census Records', auth: 'U.S. Census Bureau', publ: 'National Archives', text: 'Federal census records 1900-2020.' },
    { id: '@S4@', title: 'Immigration Records', auth: 'U.S. Citizenship and Immigration Services', publ: 'National Archives', text: 'Ship manifests and naturalization records.' },
    { id: '@S5@', title: 'Church Records', auth: 'Various parishes', publ: 'Diocesan archives', text: 'Baptism, marriage, and burial records from church registers.' },
    { id: '@S6@', title: 'Newspaper Archives', auth: 'Various publishers', publ: 'Historical newspaper collections', text: 'Birth announcements, obituaries, and wedding notices.' },
    { id: '@S7@', title: 'Military Records', auth: 'U.S. Department of Defense', publ: 'National Personnel Records Center', text: 'Service records and discharge papers.' },
    { id: '@S8@', title: 'Social Security Death Index', auth: 'Social Security Administration', publ: 'Ancestry.com', text: 'Death records from Social Security Administration.' },
];

// County mappings for US states (simplified)
const STATE_COUNTIES = {
    'Massachusetts': { 'Boston': 'Suffolk County', 'Cambridge': 'Middlesex County', 'Worcester': 'Worcester County' },
    'California': { 'Los Angeles': 'Los Angeles County', 'San Francisco': 'San Francisco County', 'San Diego': 'San Diego County', 'Sacramento': 'Sacramento County' },
    'Texas': { 'Houston': 'Harris County', 'San Antonio': 'Bexar County', 'Austin': 'Travis County', 'El Paso': 'El Paso County', 'Dallas': 'Dallas County' },
    'Illinois': { 'Chicago': 'Cook County', 'Springfield': 'Sangamon County' },
    'New York': { 'New York': 'New York County', 'Buffalo': 'Erie County', 'Albany': 'Albany County' },
    'Florida': { 'Miami': 'Miami-Dade County', 'Orlando': 'Orange County', 'Tampa': 'Hillsborough County', 'Jacksonville': 'Duval County' },
    'Arizona': { 'Phoenix': 'Maricopa County', 'Tucson': 'Pima County' },
    'Washington': { 'Seattle': 'King County', 'Portland': 'Multnomah County', 'Spokane': 'Spokane County' },
    'Oregon': { 'Portland': 'Multnomah County', 'Eugene': 'Lane County', 'Salem': 'Marion County' },
    'Wisconsin': { 'Milwaukee': 'Milwaukee County', 'Madison': 'Dane County' },
    'Minnesota': { 'Minneapolis': 'Hennepin County', 'Saint Paul': 'Ramsey County' },
    'Michigan': { 'Detroit': 'Wayne County', 'Grand Rapids': 'Kent County' },
    'Pennsylvania': { 'Philadelphia': 'Philadelphia County', 'Pittsburgh': 'Allegheny County' },
    'Ohio': { 'Columbus': 'Franklin County', 'Cleveland': 'Cuyahoga County', 'Cincinnati': 'Hamilton County' },
    'Georgia': { 'Atlanta': 'Fulton County', 'Savannah': 'Chatham County' },
    'Colorado': { 'Denver': 'Denver County', 'Colorado Springs': 'El Paso County' },
    'Nevada': { 'Las Vegas': 'Clark County', 'Reno': 'Washoe County' },
    'Hawaii': { 'Honolulu': 'Honolulu County', 'Maui': 'Maui County' },
};

function getCounty(city, state) {
    const stateCounties = STATE_COUNTIES[state];
    if (stateCounties && stateCounties[city]) {
        return stateCounties[city];
    }
    return null;
}

function enhancePlace(placeLine) {
    // Parse: "2 PLAC City, State, USA" or "2 PLAC City, Country"
    const match = placeLine.match(/^2 PLAC (.+)$/);
    if (!match) return placeLine;

    const parts = match[1].split(',').map(p => p.trim());

    // Already has county or 4+ parts, skip
    if (parts.length >= 4) return placeLine;

    // Check for US pattern: "City, State, USA"
    if (parts.length === 3 && parts[2] === 'USA') {
        const city = parts[0];
        const state = parts[1];
        const county = getCounty(city, state);
        if (county) {
            return `2 PLAC ${city}, ${county}, ${state}, USA`;
        }
    }

    return placeLine;
}

function processFile(inputPath, outputPath) {
    const content = fs.readFileSync(inputPath, 'utf8');
    const lines = content.split('\n');

    const outputLines = [];
    let headerEnded = false;
    let sourcesAdded = false;
    let indiCount = 0;
    let lastTag = '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Track when we exit the header
        if (line.startsWith('0 @I') && !sourcesAdded) {
            // Add sources before first individual
            for (const src of SOURCES) {
                outputLines.push(`0 ${src.id} SOUR`);
                outputLines.push(`1 TITL ${src.title}`);
                outputLines.push(`1 AUTH ${src.auth}`);
                outputLines.push(`1 PUBL ${src.publ}`);
                outputLines.push(`1 TEXT ${src.text}`);
            }
            sourcesAdded = true;
        }

        // Enhance place lines and add source citations
        if (line.startsWith('2 PLAC ')) {
            outputLines.push(enhancePlace(line));

            // Add source citation after place for BIRT, DEAT, MARR (if not already has one)
            const nextLine = lines[i + 1] || '';
            if (['BIRT', 'DEAT', 'MARR'].includes(lastTag) && !nextLine.startsWith('2 SOUR')) {
                // Pick a source based on the type
                let sourceId;
                if (lastTag === 'BIRT') {
                    sourceId = '@S2@'; // Vital records
                } else if (lastTag === 'DEAT') {
                    sourceId = '@S8@'; // Death index
                } else if (lastTag === 'MARR') {
                    sourceId = '@S5@'; // Church records
                }
                outputLines.push(`2 SOUR ${sourceId}`);
            }
            continue;
        }

        // Track the event type
        if (line.startsWith('1 BIRT')) lastTag = 'BIRT';
        else if (line.startsWith('1 DEAT')) lastTag = 'DEAT';
        else if (line.startsWith('1 MARR')) lastTag = 'MARR';
        else if (line.startsWith('1 ') && !line.startsWith('1 DATE') && !line.startsWith('1 PLAC')) {
            lastTag = '';
        }

        // Count individuals
        if (line.startsWith('0 @I')) {
            indiCount++;
        }

        outputLines.push(line);
    }

    fs.writeFileSync(outputPath, outputLines.join('\n'));
    console.log(`Processed ${inputPath} -> ${outputPath}`);
    console.log(`  Individuals: ${indiCount}`);
    console.log(`  Sources added: ${SOURCES.length}`);
}

// Main
const args = process.argv.slice(2);
if (args.length !== 2) {
    console.log('Usage: node enhance-gedcom.js input.ged output.ged');
    process.exit(1);
}

processFile(args[0], args[1]);
