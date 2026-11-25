const fs = require('fs');
const content = fs.readFileSync('scratch/user_sample.csv', 'utf8');
const { parseCSV } = require('./parse_util.js');

const rows = parseCSV(content);

console.log('--- CBSE Header Row 0:');
rows[0].forEach((c, i) => { if (c) console.log(`Col ${i}: "${c.replace(/\n/g, '\\n')}"`); });

console.log('\n--- CBSE Header Row 1:');
rows[1].forEach((c, i) => { if (c) console.log(`Col ${i}: "${c.replace(/\n/g, '\\n')}"`); });

console.log('\n--- CBSE Header Row 2:');
rows[2].forEach((c, i) => { if (c) console.log(`Col ${i}: "${c.replace(/\n/g, '\\n')}"`); });

console.log('\n--- First CBSE Student (Row 3):');
rows[3].forEach((c, i) => { if (c) console.log(`Col ${i}: "${c}"`); });
