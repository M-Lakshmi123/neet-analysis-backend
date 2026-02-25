const XLSX = require('xlsx');
const path = require('path');

const filePath = 'f:\\Projects\\NEET Analysis\\Result\\JR ELITE\\BEN_PU College ECITY NEET BOYS.xls';

try {
    const wb = XLSX.readFile(filePath);
    console.log('File:', path.basename(filePath));
    console.log('Sheets:', wb.SheetNames);
} catch (err) {
    console.error('Error reading file:', err);
}
