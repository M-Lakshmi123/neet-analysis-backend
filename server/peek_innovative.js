const XLSX = require('xlsx');
const path = require('path');

const filePath = 'f:\\Projects\\NEET Analysis\\Result\\JR ELITE\\BEN_PU COLLEGE BELLANDUR.xls';

try {
    const wb = XLSX.readFile(filePath);
    const ws = wb.Sheets['INNOVATIVE REPORT'];
    if (ws) {
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
        console.log('--- INNOVATIVE REPORT Sheet (Top 10 rows) ---');
        data.slice(0, 10).forEach((row, i) => console.log(`Row ${i + 1}:`, row));
    }
} catch (err) { }
