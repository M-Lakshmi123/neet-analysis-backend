const XLSX = require('xlsx');
const path = require('path');

const CONFIG_PATH = 'f:\\Projects\\NEET Analysis\\Uploader_Config.xlsx';
const configWb = XLSX.readFile(CONFIG_PATH);

console.log('Sheet Names:', configWb.SheetNames);

configWb.SheetNames.forEach(sheetName => {
    console.log(`\n--- Sheet: ${sheetName} ---`);
    const sheet = configWb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);
    if (data.length > 0) {
        console.log('Columns:', Object.keys(data[0]));
        console.log('First Row (Sample):', data[0]);
        
        // Count entries by year if the column exists
        const yearCol = Object.keys(data[0]).find(k => k.toUpperCase() === 'YEAR');
        if (yearCol) {
            const counts = {};
            data.forEach(row => {
                const y = row[yearCol];
                counts[y] = (counts[y] || 0) + 1;
            });
            console.log('Year Counts:', counts);
        }
    } else {
        console.log('Sheet is empty');
    }
});
