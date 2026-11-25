const fs = require('fs');
const content = fs.readFileSync('scratch/user_sample.csv', 'utf8');
const { parseCSV } = require('./parse_util.js');

const rows = parseCSV(content);

console.log('--- STATE Header Row 89:');
rows[89].forEach((c, i) => { if (c) console.log(`Col ${i}: "${c.replace(/\n/g, '\\n')}"`); });

console.log('\n--- STATE Header Row 90:');
rows[90].forEach((c, i) => { if (c) console.log(`Col ${i}: "${c.replace(/\n/g, '\\n')}"`); });

console.log('\n--- STATE Header Row 91:');
rows[91].forEach((c, i) => { if (c) console.log(`Col ${i}: "${c.replace(/\n/g, '\\n')}"`); });

console.log('\n--- First STATE Student (Row 92):');
rows[92].forEach((c, i) => { if (c) console.log(`Col ${i}: "${c}"`); });
