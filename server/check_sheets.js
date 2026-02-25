const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const dir = 'f:\\Projects\\NEET Analysis\\Result\\JR ELITE';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.xls') || f.endsWith('.xlsx'));

files.slice(0, 5).forEach(file => {
    const filePath = path.join(dir, file);
    try {
        const wb = XLSX.readFile(filePath);
        console.log(`File: ${file}`);
        console.log(`Sheets: ${wb.SheetNames.join(', ')}`);
        console.log('---');
    } catch (e) {
        console.error(`Error reading ${file}:`, e);
    }
});
