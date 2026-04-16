const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const CONFIG_PATH = path.join(__dirname, '..', 'Uploader_Config.xlsx');
const configWb = XLSX.readFile(CONFIG_PATH);

const sheetJR = configWb.Sheets['JR ELITE'];
const dataJR = XLSX.utils.sheet_to_json(sheetJR);
console.log('--- JR ELITE ---');
console.log(dataJR.slice(0, 3));

const sheetSR = configWb.Sheets['SR ELITE'];
const dataSR = XLSX.utils.sheet_to_json(sheetSR);
console.log('--- SR ELITE ---');
console.log(dataSR.slice(0, 3));

console.log("\nConfig Map Logic in ERP:");
const configMap = new Map();
configWb.SheetNames.forEach(sheetName => {
    if (sheetName.toUpperCase().includes('CAMPUS')) return;
    const sheet = configWb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);
    data.forEach(row => {
        const idCol = Object.keys(row).find(k => k.toUpperCase().includes('ID') || k.toUpperCase().includes('ADM'));
        const id = idCol ? row[idCol] : (row['STUD_ID'] || row['stud_id'] || Object.values(row)[0]);

        const catCol = Object.keys(row).find(k => k.toUpperCase().includes('CATEGORY') || k.toUpperCase().includes('TOP'));
        let category = String(catCol ? row[catCol] : (row['Category'] || 'TOP')).trim().toUpperCase();

        if (id) {
            const nid = String(id || '').trim().replace(/[^0-9]/g, '');
            configMap.set(nid, category);
        }
    });
});
console.log('ERP Map size:', configMap.size);
console.log('ERP Map sample:', Array.from(configMap.entries()).slice(0, 5));

console.log("\nConfig Map Logic in Results:");
const loadTopSheet = (sheetName, targetMap) => {
    const sheet = configWb.Sheets[sheetName];
    if (sheet) {
        const data = XLSX.utils.sheet_to_json(sheet);
        data.forEach(row => {
            const id = row['STUD_ID'] || row['stud_id'] || row['STUD ID'];
            const category = row['Category'] || row['CATEGORY'] || row['Top_ALL'] || 'TOP';
            if (id) targetMap.set(String(id).trim(), String(category).trim());
        });
    }
};
const streamTopMapSR = new Map();
loadTopSheet('SR ELITE', streamTopMapSR);
console.log('Result Map SR size:', streamTopMapSR.size);
console.log('Result Map SR sample:', Array.from(streamTopMapSR.entries()).slice(0, 5));

