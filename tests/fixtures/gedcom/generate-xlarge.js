// Generate extra-large GEDCOM file with 250+ people across 7 generations
const fs = require('fs');

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

let individualId = 1;
let familyId = 1;
const individuals = [];
const families = [];

// Generation structure: more people in middle generations
const genConfig = [
  { gen: 1, count: 10, birthStart: 1880, birthEnd: 1900, allDeceased: true },
  { gen: 2, count: 20, birthStart: 1900, birthEnd: 1920, allDeceased: true },
  { gen: 3, count: 35, birthStart: 1920, birthEnd: 1940, mostDeceased: true },
  { gen: 4, count: 50, birthStart: 1940, birthEnd: 1965, someDeceased: true },
  { gen: 5, count: 70, birthStart: 1965, birthEnd: 1985, allLiving: true },
  { gen: 6, count: 70, birthStart: 1985, birthEnd: 2005, allLiving: true },
  { gen: 7, count: 40, birthStart: 2000, birthEnd: 2024, allLiving: true }
];

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
    indi += `2 DATE ${randomDate(deathYear, Math.min(deathYear + 10, 2024))}\n`;
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
const gen1Config = genConfig[0];
const numGen1Couples = Math.floor(gen1Config.count / 2);
for (let i = 0; i < numGen1Couples; i++) {
  const husband = createIndividual('M', gen1Config.birthStart, gen1Config.birthEnd, true);
  const wife = createIndividual('F', gen1Config.birthStart, gen1Config.birthEnd, true);
  gen1.push(husband, wife);
  individuals.push(husband, wife);
}
generations.push(gen1);

// Generations 2-7
for (let g = 1; g < genConfig.length; g++) {
  const prevGen = generations[g - 1];
  const config = genConfig[g];
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

  // Add some additional marriages within this generation
  const numAdditionalCouples = Math.floor((config.count - thisGen.length) / 2);
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

// Add some multiple marriages (10 people with second marriages)
const multipleMarriageCount = 10;
for (let i = 0; i < multipleMarriageCount; i++) {
  const genIndex = 2 + Math.floor(Math.random() * 3); // Generations 3-5
  const gen = generations[genIndex];
  const person = gen[Math.floor(Math.random() * gen.length)];

  if (person) {
    const config = genConfig[genIndex];
    const deceased = config.allDeceased ||
                     (config.mostDeceased && Math.random() > 0.3) ||
                     (config.someDeceased && Math.random() > 0.7);
    const spouse = createIndividual(person.sex === 'M' ? 'F' : 'M', config.birthStart, config.birthEnd, deceased);
    individuals.push(spouse);

    // Create second family
    const numChildren = Math.floor(Math.random() * 3) + 1;
    const nextGenConfig = genConfig[genIndex + 1];
    const family = person.sex === 'M'
      ? createFamily(person, spouse, numChildren, nextGenConfig)
      : createFamily(spouse, person, numChildren, nextGenConfig);
    families.push(family);
    individuals.push(...family.children);
  }
}

// Build final GEDCOM
let gedcom = `0 HEAD
1 SOUR Canvas Roots Test
2 VERS 1.0
2 NAME Canvas Roots Extra-Large Test Family
1 DEST ANY
1 DATE 20 NOV 2025
1 SUBM @SUBM1@
1 FILE gedcom-sample-xlarge.ged
1 GEDC
2 VERS 5.5.1
2 FORM LINEAGE-LINKED
1 CHAR UTF-8
0 @SUBM1@ SUBM
1 NAME Canvas Roots User
`;

individuals.forEach(ind => {
  gedcom += ind.record;
});

families.forEach(fam => {
  gedcom += fam.record;
});

gedcom += '0 TRLR\n';

fs.writeFileSync('gedcom-testing/gedcom-sample-xlarge.ged', gedcom);
console.log(`Generated GEDCOM with ${individuals.length} individuals and ${families.length} families`);
