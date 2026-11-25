const fs = require('fs');
const path = require('path');
const ExcelJS = require(path.resolve('client/node_modules/exceljs'));

// Test parsing media_1795584830408_b9715aee.xlsx
const code = fs.readFileSync('scratch/test_user_file_fix.js', 'utf8');
eval(code.substring(0, code.indexOf('async function testUserFile()')));

async function testFullIntegration() {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile('C:/Users/Administrator/.gemini/antigravity/brain/8fbdb510-dcfa-425a-9491-b1e42849ba76/.user_uploaded/media_1795584830408_b9715aee.xlsx');

    const sheetGrids = [];
    wb.worksheets.forEach(ws => {
        if (ws.name === 'Instructions') return;
        const wsRows = [];
        ws.eachRow({ includeEmpty: false }, row => {
            const rVals = [];
            for (let col = 1; col <= Math.max(ws.columnCount, 75); col++) {
                const val = getVal(row.getCell(col));
                rVals.push(val !== undefined && val !== null ? String(val).trim() : '');
            }
            wsRows.push(rVals);
        });
        if (wsRows.length > 0) {
            sheetGrids.push({ name: ws.name, rows: wsRows });
        }
    });

    const ledgerSheets = sheetGrids.filter(sg => isHorizontalLedger(sg.rows));
    console.log('Ledger sheets found:', ledgerSheets.map(s => s.name));

    let allLedgerStudents = [];
    ledgerSheets.forEach(sg => {
        const parsed = parseHorizontalLedger(sg.rows);
        allLedgerStudents.push(...parsed);
    });

    console.log('Total students parsed:', allLedgerStudents.length);

    // Compute averages
    const studentList = allLedgerStudents.map(stud => {
        const streamAverages = {};
        Object.keys(stud.streamTests).forEach(stKey => {
            const tests = stud.streamTests[stKey] || [];
            const attended = tests.filter(t => !t.isAB && (Number(t.total) > 0 || Object.values(t.marks || {}).some(m => m !== 'AB' && m !== '-' && m !== 'OPT')));
            const count = attended.length;
            const avgTot = count > 0 ? Math.round(attended.reduce((a, b) => a + (Number(b.total) || 0), 0) / count) : '-';

            const activeSubs = [...new Set(tests.flatMap(t => Object.keys(t.marks || {})))].filter(Boolean);

            const subjectAverages = {};
            activeSubs.forEach(sub => {
                const validMarks = attended
                    .map(t => t.marks?.[sub])
                    .filter(m => m !== undefined && m !== null && m !== '' && typeof m === 'number')
                    .map(Number);
                subjectAverages[sub] = validMarks.length > 0 ? Math.round(validMarks.reduce((a, b) => a + b, 0) / validMarks.length) : '-';
            });

            streamAverages[stKey] = {
                avgTotal: avgTot,
                subjectAverages,
                subjects: activeSubs
            };
        });

        return {
            ...stud,
            streamAverages
        };
    });

    const cbseStudent = studentList.find(s => s.board.includes('CBSE'));
    console.log('\n--- CBSE Student Summary ---');
    console.log('Name:', cbseStudent.name, 'ID:', cbseStudent.id, 'Section:', cbseStudent.section);
    console.log('Medical Tests Count:', cbseStudent.streamTests.MEDICAL.length);
    console.log('Medical Avg Total:', cbseStudent.streamAverages.MEDICAL.avgTotal);
    console.log('CBSE Tests Count:', cbseStudent.streamTests.CBSE.length);
    console.log('CBSE Avg Total:', cbseStudent.streamAverages.CBSE.avgTotal);
    console.log('CBSE Subjects:', cbseStudent.streamAverages.CBSE.subjects);
    console.log('CBSE Subject Averages:', cbseStudent.streamAverages.CBSE.subjectAverages);

    const puStudent = studentList.find(s => s.board.includes('STATE'));
    console.log('\n--- PU Student Summary ---');
    console.log('Name:', puStudent.name, 'ID:', puStudent.id, 'Section:', puStudent.section);
    console.log('Medical Tests Count:', puStudent.streamTests.MEDICAL.length);
    console.log('Medical Avg Total:', puStudent.streamAverages.MEDICAL.avgTotal);
    console.log('PU Tests Count:', puStudent.streamTests.PU.length);
    console.log('PU Avg Total:', puStudent.streamAverages.PU.avgTotal);
    console.log('PU Subjects:', puStudent.streamAverages.PU.subjects);
    console.log('PU Subject Averages:', puStudent.streamAverages.PU.subjectAverages);
}

testFullIntegration().catch(console.error);
