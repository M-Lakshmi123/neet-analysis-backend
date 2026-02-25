const XLSX = require('xlsx');
const path = require('path');

const filePath = 'f:\\Projects\\NEET Analysis\\Result\\JR ELITE\\BEN_PU COLLEGE BELLANDUR.xls';

try {
    const wb = XLSX.readFile(filePath);
    console.log('Sheets:', wb.SheetNames);

    const marksSheet = wb.Sheets['Marks List'];
    if (marksSheet) {
        // Use raw sheet to see if there are merged cells or something
        const range = XLSX.utils.decode_range(marksSheet['!ref']);
        for (let r = 0; r <= 10; r++) {
            let row = [];
            for (let c = 0; c <= 5; c++) {
                const cellRef = XLSX.utils.encode_cell({ r, c });
                const cell = marksSheet[cellRef];
                row.push(cell ? cell.v : null);
            }
            console.log(`Row ${r + 1}:`, row);
        }
    }
} catch (err) {
    console.error('Error reading file:', err);
}
