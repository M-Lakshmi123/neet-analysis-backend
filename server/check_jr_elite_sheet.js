const XLSX = require('xlsx');
const path = require('path');
const configWb = XLSX.readFile(path.join(__dirname, '..', 'Uploader_Config.xlsx'));

const sheet = configWb.Sheets['JR ELITE'];
const data = XLSX.utils.sheet_to_json(sheet);
const cats = new Set();
data.forEach(row => {
    const catCol = Object.keys(row).find(k => k.toUpperCase().includes('CATEGORY') || k.toUpperCase().includes('TOP'));
    let category = String(catCol ? row[catCol] : (row['Category'] || 'TOP')).trim().toUpperCase();
    cats.add(category);
});

console.log("Categories in JR ELITE sheet:");
console.log(Array.from(cats));
