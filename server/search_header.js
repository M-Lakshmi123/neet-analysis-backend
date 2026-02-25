const XLSX = require('xlsx');
const path = require('path');

const filePath = 'f:\\Projects\\NEET Analysis\\Result\\JR ELITE\\BEN_PU COLLEGE BELLANDUR.xls';

try {
    const wb = XLSX.readFile(filePath);
    wb.SheetNames.forEach(name => {
        const ws = wb.Sheets[name];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
        data.slice(0, 10).forEach((row, i) => {
            if (row && row.some(cell => String(cell).includes('Bot_Qs'))) {
                console.log(`FOUND Bot_Qs in sheet "${name}" row ${i + 1}`);
            }
        });
    });
} catch (err) {
    console.error('Error:', err);
}
