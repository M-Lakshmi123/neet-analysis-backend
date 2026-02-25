const XLSX = require('xlsx');
const path = require('path');

const filePath = 'f:\\Projects\\NEET Analysis\\Result\\JR ELITE\\BEN_PU COLLEGE BELLANDUR.xls';

try {
    const wb = XLSX.readFile(filePath);
    console.log('Sheets:', wb.SheetNames);

    const marksSheet = wb.Sheets['Marks List'];
    if (marksSheet) {
        const marksData = XLSX.utils.sheet_to_json(marksSheet, { header: 1 });
        console.log('\n--- Marks List (First 10 rows) ---');
        marksData.slice(0, 10).forEach((row, i) => {
            console.log(`Row ${i + 1}:`, row);
        });
    } else {
        console.log('\n"Marks List" sheet not found.');
    }

    const microSheet = wb.Sheets['NEET(Micro)'];
    if (microSheet) {
        const microData = XLSX.utils.sheet_to_json(microSheet, { header: 1 });
        console.log('\n--- NEET(Micro) (First 10 rows) ---');
        microData.slice(0, 10).forEach((row, i) => {
            console.log(`Row ${i + 1}:`, row);
        });
    } else {
        console.log('\n"NEET(Micro)" sheet not found.');
    }

} catch (err) {
    console.error('Error reading file:', err);
}
