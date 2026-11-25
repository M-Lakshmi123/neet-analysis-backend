const fs = require('fs');
const path = require('path');
const ExcelJS = require(path.resolve('client/node_modules/exceljs'));

const code = fs.readFileSync('scratch/test_user_file_fix.js', 'utf8');
eval(code.substring(0, code.indexOf('async function testUserFile()')));

function parseCSV(text) {
    const rows = [];
    let currentRow = [];
    let currentCell = '';
    let insideQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];
        if (char === '"') {
            if (insideQuotes && nextChar === '"') { currentCell += '"'; i++; }
            else { insideQuotes = !insideQuotes; }
        } else if (char === ',' && !insideQuotes) {
            currentRow.push(currentCell.trim());
            currentCell = '';
        } else if ((char === '\r' || char === '\n') && !insideQuotes) {
            if (char === '\r' && nextChar === '\n') i++;
            currentRow.push(currentCell.trim());
            if (currentRow.some(c => c !== '')) rows.push(currentRow);
            currentRow = [];
            currentCell = '';
        } else { currentCell += char; }
    }
    if (currentCell || currentRow.length > 0) {
        currentRow.push(currentCell.trim());
        if (currentRow.some(c => c !== '')) rows.push(currentRow);
    }
    return rows;
}

const csvText = fs.readFileSync('scratch/user_sample.csv', 'utf8');
const rows = parseCSV(csvText);
console.log('--- CSV Parsing Test ---');
console.log('Is horizontal ledger:', isHorizontalLedger(rows));
const studs = parseHorizontalLedger(rows);
console.log('Total students parsed from user_sample.csv:', studs.length);
if (studs.length > 0) {
    console.log('Student 1:', studs[0].name, 'Medical tests:', studs[0].streamTests.MEDICAL.length, 'CBSE tests:', studs[0].streamTests.CBSE.length, 'Attendance:', studs[0].attendance);
    const pu = studs.find(s => s.board.includes('STATE'));
    if (pu) {
        console.log('PU Student:', pu.name, 'Medical tests:', pu.streamTests.MEDICAL.length, 'PU tests:', pu.streamTests.PU.length, 'Attendance:', pu.attendance);
    }
}
