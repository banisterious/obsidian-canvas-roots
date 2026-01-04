#!/usr/bin/env node
/**
 * Generate GEDCOM files of configurable size for load testing
 *
 * Usage:
 *   node generate-loadtest.js <target-people> [output-file]
 *
 * Examples:
 *   node generate-loadtest.js 1500                    # Creates gedcom-loadtest-1500.ged
 *   node generate-loadtest.js 3000 my-test.ged       # Creates my-test.ged with ~3000 people
 *   node generate-loadtest.js 5000                    # Creates gedcom-loadtest-5000.ged
 *
 * The generator creates realistic family structures with:
 *   - 7 generations (configurable via GENERATION_COUNT)
 *   - 2-6 children per family (weighted toward 2-4)
 *   - ~10% of people have multiple marriages
 *   - Realistic birth/death dates
 *   - International locations
 */

const fs = require('fs');

// Configuration
const GENERATION_COUNT = 7;
const MULTIPLE_MARRIAGE_PERCENT = 0.1;

const surnames = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
  'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Thompson', 'White',
  'Harris', 'Clark', 'Lewis', 'Robinson', 'Walker', 'Hall', 'Young', 'King',
  'Wright', 'Hill', 'Scott', 'Green', 'Adams', 'Baker', 'Nelson', 'Carter',
  'Mitchell', 'Roberts', 'Turner', 'Phillips', 'Campbell', 'Parker', 'Evans',
  'Edwards', 'Collins', 'Stewart', 'Morris', 'Murphy', 'Cook', 'Rogers', 'Morgan',
  'Peterson', 'Cooper', 'Reed', 'Bailey', 'Bell', 'Gomez', 'Kelly', 'Howard',
  'Ward', 'Cox', 'Diaz', 'Richardson', 'Wood', 'Watson', 'Brooks', 'Bennett',
  'Gray', 'James', 'Reyes', 'Cruz', 'Hughes', 'Price', 'Myers', 'Long',
  'Foster', 'Sanders', 'Ross', 'Morales', 'Powell', 'Sullivan', 'Russell',
  'Ortiz', 'Jenkins', 'Gutierrez', 'Perry', 'Butler', 'Barnes', 'Fisher'
];

const maleNames = [
  'James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph',
  'Thomas', 'Charles', 'Christopher', 'Daniel', 'Matthew', 'Anthony', 'Donald',
  'Mark', 'Paul', 'Steven', 'Andrew', 'Kenneth', 'Joshua', 'George', 'Kevin',
  'Brian', 'Edward', 'Ronald', 'Timothy', 'Jason', 'Jeffrey', 'Ryan', 'Jacob',
  'Gary', 'Nicholas', 'Eric', 'Stephen', 'Jonathan', 'Larry', 'Justin', 'Scott',
  'Brandon', 'Frank', 'Benjamin', 'Gregory', 'Samuel', 'Raymond', 'Patrick',
  'Alexander', 'Jack', 'Dennis', 'Jerry', 'Tyler', 'Aaron', 'Henry', 'Douglas',
  'Jose', 'Peter', 'Adam', 'Zachary', 'Nathan', 'Walter', 'Harold', 'Kyle',
  'Carl', 'Arthur', 'Gerald', 'Roger', 'Keith', 'Jeremy', 'Terry', 'Lawrence'
];

const femaleNames = [
  'Mary', 'Patricia', 'Jennifer', 'Linda', 'Barbara', 'Elizabeth', 'Susan',
  'Jessica', 'Sarah', 'Karen', 'Nancy', 'Margaret', 'Lisa', 'Betty', 'Dorothy',
  'Sandra', 'Ashley', 'Kimberly', 'Donna', 'Emily', 'Michelle', 'Carol', 'Amanda',
  'Melissa', 'Deborah', 'Stephanie', 'Rebecca', 'Laura', 'Sharon', 'Cynthia',
  'Kathleen', 'Amy', 'Shirley', 'Angela', 'Helen', 'Anna', 'Brenda', 'Pamela',
  'Nicole', 'Emma', 'Samantha', 'Katherine', 'Christine', 'Debra', 'Rachel',
  'Catherine', 'Carolyn', 'Janet', 'Ruth', 'Maria', 'Heather', 'Diane', 'Virginia',
  'Julie', 'Joyce', 'Victoria', 'Olivia', 'Kelly', 'Christina', 'Lauren', 'Joan',
  'Evelyn', 'Judith', 'Megan', 'Cheryl', 'Andrea', 'Hannah', 'Jacqueline', 'Martha'
];

const cities = [
  'New York, New York', 'Los Angeles, California', 'Chicago, Illinois',
  'Houston, Texas', 'Phoenix, Arizona', 'Philadelphia, Pennsylvania',
  'San Antonio, Texas', 'San Diego, California', 'Dallas, Texas',
  'San Jose, California', 'Austin, Texas', 'Jacksonville, Florida',
  'Fort Worth, Texas', 'Columbus, Ohio', 'Charlotte, North Carolina',
  'San Francisco, California', 'Indianapolis, Indiana', 'Seattle, Washington',
  'Denver, Colorado', 'Boston, Massachusetts', 'Portland, Oregon',
  'Nashville, Tennessee', 'Oklahoma City, Oklahoma', 'Las Vegas, Nevada',
  'Detroit, Michigan', 'Memphis, Tennessee', 'Louisville, Kentucky',
  'Baltimore, Maryland', 'Milwaukee, Wisconsin', 'Albuquerque, New Mexico',
  'London, England', 'Paris, France', 'Berlin, Germany', 'Rome, Italy',
  'Madrid, Spain', 'Dublin, Ireland', 'Amsterdam, Netherlands', 'Oslo, Norway',
  'Stockholm, Sweden', 'Copenhagen, Denmark', 'Vienna, Austria', 'Prague, Czech Republic',
  'Warsaw, Poland', 'Budapest, Hungary', 'Athens, Greece', 'Lisbon, Portugal',
  'Mexico City, Mexico', 'Toronto, Canada', 'Vancouver, Canada', 'Montreal, Canada',
  'Tokyo, Japan', 'Seoul, South Korea', 'Beijing, China', 'Shanghai, China',
  'Mumbai, India', 'Sydney, Australia', 'Melbourne, Australia', 'Auckland, New Zealand'
];

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(startYear, endYear) {
  const year = startYear + Math.floor(Math.random() * (endYear - startYear + 1));
  const month = Math.floor(Math.random() * 12) + 1;
  const day = Math.floor(Math.random() * 28) + 1;
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return `${day} ${months[month - 1]} ${year}`;
}

/**
 * Calculate generation distribution to hit target people count
 * Uses exponential growth pattern typical of family trees
 */
function calculateGenerationSizes(targetPeople) {
  // Base distribution ratios (normalized)
  const baseRatios = [0.03, 0.06, 0.10, 0.15, 0.22, 0.24, 0.20];

  // Calculate initial sizes
  let sizes = baseRatios.map(r => Math.max(2, Math.round(r * targetPeople)));

  // Adjust to hit target
  let total = sizes.reduce((a, b) => a + b, 0);
  const scale = targetPeople / total;
  sizes = sizes.map(s => Math.max(2, Math.round(s * scale)));

  // Fine-tune to get closer to target
  total = sizes.reduce((a, b) => a + b, 0);
  const diff = targetPeople - total;
  if (diff > 0) {
    // Add to middle generations
    for (let i = 0; i < diff; i++) {
      sizes[3 + (i % 3)]++;
    }
  } else if (diff < 0) {
    // Remove from largest generations
    for (let i = 0; i < -diff; i++) {
      const maxIdx = sizes.indexOf(Math.max(...sizes));
      if (sizes[maxIdx] > 2) sizes[maxIdx]--;
    }
  }

  return sizes;
}

function generateGedcom(targetPeople) {
  let individualId = 1;
  let familyId = 1;
  const individuals = [];
  const families = [];

  const genSizes = calculateGenerationSizes(targetPeople);

  // Calculate year ranges for each generation (working backward from present)
  const currentYear = new Date().getFullYear();
  const genConfigs = genSizes.map((count, idx) => {
    const genFromEnd = GENERATION_COUNT - 1 - idx;
    const birthStart = currentYear - 25 - (genFromEnd * 25) - 20;
    const birthEnd = currentYear - 25 - (genFromEnd * 25);
    const allDeceased = idx < 2;
    const mostDeceased = idx === 2;
    const someDeceased = idx === 3;

    return { gen: idx + 1, count, birthStart, birthEnd, allDeceased, mostDeceased, someDeceased };
  });

  function createIndividual(sex, birthStart, birthEnd, deceased) {
    const id = `I${individualId++}`;
    const name = sex === 'M' ? randomChoice(maleNames) : randomChoice(femaleNames);
    const surname = randomChoice(surnames);
    const birthDate = randomDate(birthStart, birthEnd);
    const birthPlace = randomChoice(cities);

    let indi = `0 @${id}@ INDI\n`;
    indi += `1 NAME ${name} /${surname}/\n`;
    indi += `2 GIVN ${name}\n`;
    indi += `2 SURN ${surname}\n`;
    indi += `1 SEX ${sex}\n`;
    indi += `1 BIRT\n`;
    indi += `2 DATE ${birthDate}\n`;
    indi += `2 PLAC ${birthPlace}\n`;

    if (deceased) {
      const birthYear = parseInt(birthDate.split(' ')[2]);
      const deathYear = birthYear + 60 + Math.floor(Math.random() * 30);
      indi += `1 DEAT\n`;
      indi += `2 DATE ${randomDate(deathYear, Math.min(deathYear + 10, currentYear))}\n`;
      indi += `2 PLAC ${randomChoice(cities)}\n`;
    }

    return { id, record: indi, name, surname, sex };
  }

  function createFamily(husband, wife, numChildren, childGenConfig) {
    const fid = `F${familyId++}`;
    let fam = `0 @${fid}@ FAM\n`;
    fam += `1 HUSB @${husband.id}@\n`;
    fam += `1 WIFE @${wife.id}@\n`;

    const husbandBirthYear = parseInt(husband.record.match(/BIRT\n2 DATE \d+ \w+ (\d+)/)[1]);
    const marriageYear = husbandBirthYear + 20 + Math.floor(Math.random() * 10);
    fam += `1 MARR\n`;
    fam += `2 DATE ${randomDate(marriageYear, marriageYear)}\n`;
    fam += `2 PLAC ${randomChoice(cities)}\n`;

    const children = [];
    for (let i = 0; i < numChildren; i++) {
      const sex = Math.random() > 0.5 ? 'M' : 'F';
      const deceased = childGenConfig.allDeceased ||
                       (childGenConfig.mostDeceased && Math.random() > 0.3) ||
                       (childGenConfig.someDeceased && Math.random() > 0.7);
      const child = createIndividual(sex, childGenConfig.birthStart, childGenConfig.birthEnd, deceased);
      child.record += `1 FAMC @${fid}@\n`;
      children.push(child);
      fam += `1 CHIL @${child.id}@\n`;
    }

    husband.record += `1 FAMS @${fid}@\n`;
    wife.record += `1 FAMS @${fid}@\n`;

    return { id: fid, record: fam, children };
  }

  // Build the tree
  const generations = [];

  // Generation 1 (oldest ancestors)
  const gen1 = [];
  const gen1Config = genConfigs[0];
  const numGen1Couples = Math.floor(gen1Config.count / 2);
  for (let i = 0; i < numGen1Couples; i++) {
    const husband = createIndividual('M', gen1Config.birthStart, gen1Config.birthEnd, true);
    const wife = createIndividual('F', gen1Config.birthStart, gen1Config.birthEnd, true);
    gen1.push(husband, wife);
    individuals.push(husband, wife);
  }
  generations.push(gen1);

  // Generations 2-7
  for (let g = 1; g < genConfigs.length; g++) {
    const prevGen = generations[g - 1];
    const config = genConfigs[g];
    const thisGen = [];

    // Create couples from previous generation
    const numCouples = Math.floor(prevGen.length / 2);

    for (let i = 0; i < numCouples; i++) {
      const parent1 = prevGen[i * 2];
      const parent2 = prevGen[i * 2 + 1];

      if (!parent1 || !parent2) continue;

      // Determine number of children (2-6, with higher chance of 2-4)
      let numChildren;
      const rand = Math.random();
      if (rand < 0.3) numChildren = 2;
      else if (rand < 0.6) numChildren = 3;
      else if (rand < 0.8) numChildren = 4;
      else if (rand < 0.95) numChildren = 5;
      else numChildren = 6;

      const family = createFamily(parent1, parent2, numChildren, config);
      families.push(family);

      thisGen.push(...family.children);
      individuals.push(...family.children);
    }

    // Add some additional couples within this generation to reach target count
    const targetForGen = config.count;
    const additionalNeeded = targetForGen - thisGen.length;
    const numAdditionalCouples = Math.max(0, Math.floor(additionalNeeded / 2));

    for (let i = 0; i < numAdditionalCouples; i++) {
      const deceased = config.allDeceased ||
                       (config.mostDeceased && Math.random() > 0.3) ||
                       (config.someDeceased && Math.random() > 0.7);
      const husband = createIndividual('M', config.birthStart, config.birthEnd, deceased);
      const wife = createIndividual('F', config.birthStart, config.birthEnd, deceased);
      individuals.push(husband, wife);
      thisGen.push(husband, wife);
    }

    generations.push(thisGen);
  }

  // Add multiple marriages
  const multipleMarriageCount = Math.floor(individuals.length * MULTIPLE_MARRIAGE_PERCENT);
  for (let i = 0; i < multipleMarriageCount; i++) {
    const genIndex = 2 + Math.floor(Math.random() * 3); // Generations 3-5
    if (genIndex >= generations.length - 1) continue;

    const gen = generations[genIndex];
    const person = gen[Math.floor(Math.random() * gen.length)];

    if (person && genIndex + 1 < genConfigs.length) {
      const config = genConfigs[genIndex];
      const deceased = config.allDeceased ||
                       (config.mostDeceased && Math.random() > 0.3) ||
                       (config.someDeceased && Math.random() > 0.7);
      const spouse = createIndividual(person.sex === 'M' ? 'F' : 'M', config.birthStart, config.birthEnd, deceased);
      individuals.push(spouse);

      // Create second family
      const numChildren = Math.floor(Math.random() * 3) + 1;
      const nextGenConfig = genConfigs[genIndex + 1];
      const family = person.sex === 'M'
        ? createFamily(person, spouse, numChildren, nextGenConfig)
        : createFamily(spouse, person, numChildren, nextGenConfig);
      families.push(family);
      individuals.push(...family.children);
    }
  }

  // Build final GEDCOM
  let gedcom = `0 HEAD
1 SOUR Canvas Roots Load Test
2 VERS 1.0
2 NAME Canvas Roots Load Test Family (${individuals.length} people)
1 DEST ANY
1 DATE ${new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase().replace(',', '')}
1 SUBM @SUBM1@
1 FILE gedcom-loadtest-${individuals.length}.ged
1 GEDC
2 VERS 5.5.1
2 FORM LINEAGE-LINKED
1 CHAR UTF-8
0 @SUBM1@ SUBM
1 NAME Canvas Roots Load Test User
`;

  individuals.forEach(ind => {
    gedcom += ind.record;
  });

  families.forEach(fam => {
    gedcom += fam.record;
  });

  gedcom += '0 TRLR\n';

  return { gedcom, individualCount: individuals.length, familyCount: families.length };
}

// Main
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log(`
Usage: node generate-loadtest.js <target-people> [output-file]

Examples:
  node generate-loadtest.js 1500                    # Creates gedcom-loadtest-1500.ged
  node generate-loadtest.js 3000 my-test.ged       # Creates my-test.ged with ~3000 people
  node generate-loadtest.js 5000                    # Creates gedcom-loadtest-5000.ged

Recommended test sizes:
  - 1500  (xxlarge)   - Real-world large tree, ~2-3s expected render
  - 3000  (xxxlarge)  - Stress test, ~5-10s expected render
  - 5000+ (extreme)   - Find breaking points
`);
  process.exit(1);
}

const targetPeople = parseInt(args[0], 10);
if (isNaN(targetPeople) || targetPeople < 10) {
  console.error('Error: Target people must be a number >= 10');
  process.exit(1);
}

const outputFile = args[1] || `gedcom-testing/gedcom-loadtest-${targetPeople}.ged`;

console.log(`Generating GEDCOM with target of ${targetPeople} people...`);
const { gedcom, individualCount, familyCount } = generateGedcom(targetPeople);

fs.writeFileSync(outputFile, gedcom);
console.log(`✓ Generated: ${outputFile}`);
console.log(`  - Individuals: ${individualCount}`);
console.log(`  - Families: ${familyCount}`);
console.log(`  - File size: ${(gedcom.length / 1024).toFixed(1)} KB`);
