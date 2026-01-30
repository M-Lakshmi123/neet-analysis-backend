const fs = require('fs');
const path = require('path');
const logPath = 'query_debug.log';
const content = fs.readFileSync(logPath, 'utf8');
const entries = content.split('---\n');
const lastEntry = entries[entries.length - 2]; // last one is empty after split
console.log(lastEntry);
