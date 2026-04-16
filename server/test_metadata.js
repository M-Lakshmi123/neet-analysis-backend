const fs = require('fs');
const XLSX = require('xlsx');
const path = require('path');
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
const files = findResultFiles(RESULT_DIR);

if (files.length > 0) {
    const wb = XLSX.readFile(files[0].path);
    const marksWs = wb.Sheets['Marks List'];
    const marksData = XLSX.utils.sheet_to_json(marksWs, { header: 1 });
    const row4 = marksData[3] || [];
    function normalizeHeader(h) {
        if (!h) return "";
        return String(h).trim().toUpperCase().replace(/\r?\n/g, ' ').replace(/\s+/g, '');
    }
    const studIdCol = row4.findIndex(h => normalizeHeader(h).includes(normalizeHeader('STUD_ID')));
    console.log('STUD ID Col:', studIdCol, row4[studIdCol]);

    for(let i = 6; i < 11; i++) {
        if (marksData[i]) {
            console.log('STUD_ID (Result):', marksData[i][studIdCol], 'Type:', typeof marksData[i][studIdCol]);
        }
    }
}
