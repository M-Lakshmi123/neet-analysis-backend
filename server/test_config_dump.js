const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const wb = XLSX.readFile(path.join(__dirname, '..', 'Uploader_Config.xlsx'));
const configMap = new Map();
XLSX.utils.sheet_to_json(wb.Sheets['JR ELITE']).forEach(row => {
    configMap.set(String(row['STUD_ID']).trim(), String(row['Category']));
});
XLSX.utils.sheet_to_json(wb.Sheets['SR ELITE']).forEach(row => {
    configMap.set(String(row['STUD_ID']).trim(), String(row['Category']));
});

const RESULT_DIR = path.join(__dirname, '..', 'Result');
function findResultFiles(dir, parentDir = '') {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            results = results.concat(findResultFiles(fullPath, file));
        } else if ((file.endsWith('.xls') || file.endsWith('.xlsx')) && !file.startsWith('~$')) {
            results.push({ path: fullPath, folder: parentDir });
        }
    });
    return results;
}
const resultFiles = findResultFiles(RESULT_DIR);
let totalMatches = 0;
for(const rf of resultFiles) {
    const rWb = XLSX.readFile(rf.path);
    const marksWs = rWb.Sheets['Marks List'];
    if(!marksWs) continue;
    const marksData = XLSX.utils.sheet_to_json(marksWs, { header: 1 });
    const row4 = marksData[3] || [];
    function normalizeHeader(h) { return String(h || '').trim().toUpperCase().replace(/\r?\n/g, ' ').replace(/\s+/g, ''); }
    const studIdCol = row4.findIndex(h => normalizeHeader(h).includes(normalizeHeader('STUD_ID')));

    let matchCount = 0;
    for(let i = 6; i < marksData.length; i++) {
        if(marksData[i] && marksData[i][studIdCol]) {
            const sid = String(marksData[i][studIdCol]).trim();
            if (configMap.has(sid)) matchCount++;
        }
    }
    if (matchCount > 0) {
        console.log('Result file:', path.basename(rf.path), '| Matches:', matchCount);
        totalMatches += matchCount;
    }
}
console.log('Total matches exactly across all result files:', totalMatches);
