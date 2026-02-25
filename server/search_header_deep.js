const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const dir = 'f:\\Projects\\NEET Analysis\\Result\\JR ELITE';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.xls') || f.endsWith('.xlsx'));

files.slice(0, 3).forEach(file => {
    const filePath = path.join(dir, file);
    try {
        const wb = XLSX.readFile(filePath);
        wb.SheetNames.forEach(name => {
            const ws = wb.Sheets[name];
            const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
            for (let i = 0; i < Math.min(data.length, 100); i++) {
                const row = data[i];
                if (row && row.some(cell => String(cell).includes('Bot_Qs'))) {
                    console.log(`FILE: ${file}, SHEET: ${name}, ROW: ${i + 1}`);
                }
            }
        });
    } catch (err) { }
});
