const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const dir = 'f:\\Projects\\NEET Analysis\\Result\\JR ELITE';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.xls') || f.endsWith('.xlsx'));

files.forEach(file => {
    const filePath = path.join(dir, file);
    try {
        const wb = XLSX.readFile(filePath);
        wb.SheetNames.forEach(sheet => {
            if (sheet.toUpperCase().includes('MICRO')) {
                console.log(`FILE: ${file} | SHEET: ${sheet}`);
            }
        });
    } catch (e) { }
});
