const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const dir = 'f:\\Projects\\NEET Analysis\\Result\\JR ELITE';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.xls') || f.endsWith('.xlsx'));

files.forEach(file => {
    const filePath = path.join(dir, file);
    try {
        const wb = XLSX.readFile(filePath);
        if (wb.SheetNames.includes('NEET(Micro)')) {
            console.log(`FOUND NEET(Micro) in: ${file}`);
            const ws = wb.Sheets['NEET(Micro)'];
            const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
            console.log('Row 5:', data[4]);
            console.log('Row 6:', data[5]);
        }
    } catch (e) { }
});
