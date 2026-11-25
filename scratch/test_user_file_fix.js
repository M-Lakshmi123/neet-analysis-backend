const path = require('path');
const ExcelJS = require(path.resolve('client/node_modules/exceljs'));
const fs = require('fs');

function parseDateStr(str) {
    if (!str) return '';
    const clean = str.replace(/\n/g, ' ').trim();
    const m = clean.match(/DATE\s*[:-]?\s*(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/i) ||
              clean.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
    if (m) {
        let [ , d, mon, y ] = m;
        if (y === '225') y = '2025';
        else if (y.length === 2) y = '20' + y;
        return `${y}-${mon.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return '';
}

function parseTestName(str) {
    if (!str) return 'Exam';
    const firstLine = str.split('\n')[0].replace(/DATE.*/i, '').trim();
    return firstLine.replace(/[-_:\s]+$/, '').trim() || str.trim();
}

function parseNumericOrMark(val) {
    if (val === undefined || val === null) return null;
    const str = String(val).trim();
    if (str === '' || str === '-' || str === 'NaN') return null;
    const up = str.toUpperCase();
    if (up === 'OPT') return 'OPT';
    if (up === 'AB' || up === 'A' || up === 'AN') return 'AB';
    if (up === 'SICK') return 'SICK';
    if (str.includes('W') && str.includes('R') && str.includes('O')) return 'WRONG ID';
    const num = Number(str);
    if (!isNaN(num) && !isNaN(parseFloat(str))) return num;
    return str;
}

function isHorizontalLedger(rows) {
    for (let r = 0; r < Math.min(rows.length, 6); r++) {
        const rowStr = (rows[r] || []).join(' ').toUpperCase();
        if ((rowStr.includes('WET') || rowStr.includes('UT-')) && (rowStr.includes('BOT') || rowStr.includes('PHY') || rowStr.includes('PRE-MID-TERM'))) {
            return true;
        }
        if (rowStr.includes('PRE-MID-TERM') && (rowStr.includes('CBSE') || rowStr.includes('PU') || rowStr.includes('STATE'))) {
            return true;
        }
    }
    return false;
}

function parseHorizontalLedger(rows) {
    const sections = [];
    let currentSec = null;

    rows.forEach((r, idx) => {
        const rowStr = (r || []).join(' ').toUpperCase();
        const isHeaderMatch = (rowStr.includes('STUDENT NAME') || rowStr.includes('NAME')) &&
                              (rowStr.includes('WET') || rowStr.includes('UT-') || rowStr.includes('PRE-MID-TERM'));

        // If we are already inside a header block (idx <= currentSec.headerRowIdx + 2), don't start a new section!
        if (isHeaderMatch && (!currentSec || idx > currentSec.headerRowIdx + 2)) {
            if (currentSec) sections.push(currentSec);
            currentSec = {
                headerRowIdx: idx,
                headerRow: r,
                subHeader1: rows[idx + 1] || [],
                subHeader2: rows[idx + 2] || [],
                dataRows: []
            };
        } else if (currentSec && idx > currentSec.headerRowIdx + 2) {
            // Check if this row is not completely empty
            if (r.some(c => c !== '')) {
                currentSec.dataRows.push(r);
            }
        }
    });
    if (currentSec) sections.push(currentSec);

    const students = [];

    sections.forEach(sec => {
        const h0 = sec.headerRow;
        const h1 = sec.subHeader1;
        const h2 = sec.subHeader2;

        const secStr = h0.join(' ') + ' ' + h1.join(' ') + ' ' + h2.join(' ');
        const isCBSE = secStr.toUpperCase().includes('CBSE');

        let idCol = 2; // Default 7-digit OMR col
        let nameCol = 3;
        let boardCol = 4;
        let secCol = 5;

        for (let c = 0; c < 8; c++) {
            const val = (h0[c] || '').toUpperCase();
            if (val.includes('STUDENT NAME') || val === 'NAME') nameCol = c;
            else if (val.includes('BOARD')) boardCol = c;
            else if (val.includes('SECTION') || val === 'SEC') secCol = c;
        }

        const testBlocks = [];
        let curBlock = null;

        for (let c = secCol + 1; c < h0.length; c++) {
            const topH = (h0[c] || '').trim();
            const midH = (h1[c] || '').trim();
            const botH = (h2[c] || '').trim();

            if (topH && (topH.toUpperCase().includes('WET') || topH.toUpperCase().includes('UT-') || topH.toUpperCase().includes('PRE-MID-TERM'))) {
                if (!curBlock || curBlock.rawName !== topH) {
                    if (curBlock) testBlocks.push(curBlock);
                    curBlock = {
                        startCol: c,
                        endCol: c,
                        rawName: topH,
                        testName: parseTestName(topH),
                        date: parseDateStr(topH),
                        isBoard: topH.toUpperCase().includes('PRE-MID-TERM'),
                        cols: []
                    };
                }
            } else if (topH && topH.toUpperCase().includes('ATTENDANCE')) {
                if (!curBlock || curBlock.rawName !== topH) {
                    if (curBlock) testBlocks.push(curBlock);
                    curBlock = {
                        startCol: c,
                        endCol: c,
                        rawName: topH,
                        testName: 'ATTENDANCE',
                        isAttendance: true,
                        cols: []
                    };
                }
            }

            if (curBlock) {
                curBlock.endCol = c;
                curBlock.cols.push({ colIdx: c, top: topH, mid: midH, bot: botH });
            }
        }
        if (curBlock) testBlocks.push(curBlock);

        sec.dataRows.forEach(row => {
            const studId = (row[idCol] || row[1] || '').trim();
            const name = (row[nameCol] || '').trim();
            const board = (row[boardCol] || '').trim() || (isCBSE ? 'CBSE' : 'STATE');
            const section = (row[secCol] || '').trim();

            if (!name && !studId) return;

            const boardKey = board.toUpperCase().includes('CBSE') ? 'CBSE' : 'PU';
            const boardLabel = boardKey === 'CBSE' ? 'CBSE Board' : 'PU Board';

            const student = {
                id: studId,
                name: name || studId,
                campus: 'Campus',
                board,
                section,
                stream: `Medical (NEET) & ${boardLabel}`,
                streamTests: {
                    MEDICAL: [],
                    [boardKey]: []
                },
                attendance: null
            };

            testBlocks.forEach(tb => {
                if (tb.isAttendance) {
                    const wDays = row[tb.startCol];
                    const abs = row[tb.startCol + 1];
                    const pres = row[tb.startCol + 2];
                    const sick = row[tb.startCol + 3];
                    const tot = row[tb.startCol + 4];
                    if (wDays && Number(wDays) > 0) {
                        student.attendance = {
                            workingDays: wDays,
                            absent: abs || '0',
                            present: pres || '-',
                            sick: sick || '0',
                            total: tot || wDays
                        };
                    }
                    return;
                }

                if (!tb.isBoard) {
                    const marks = {};
                    let totVal = null;
                    let airVal = null;
                    let hasMarks = false;
                    let allAbsent = true;
                    let isOpt = false;

                    tb.cols.forEach(ci => {
                        const raw = row[ci.colIdx];
                        const val = parseNumericOrMark(raw);
                        if (val === 'OPT') isOpt = true;

                        const label = (ci.bot || ci.mid || ci.top).toUpperCase();
                        if (label.includes('BOT')) {
                            if (val !== null) { marks['BOTANY'] = val; hasMarks = true; if (typeof val === 'number') allAbsent = false; }
                        } else if (label.includes('ZOO')) {
                            if (val !== null) { marks['ZOOLOGY'] = val; hasMarks = true; if (typeof val === 'number') allAbsent = false; }
                        } else if (label.includes('PHY')) {
                            if (val !== null) { marks['PHYSICS'] = val; hasMarks = true; if (typeof val === 'number') allAbsent = false; }
                        } else if (label.includes('CHE')) {
                            if (val !== null) { marks['CHEMISTRY'] = val; hasMarks = true; if (typeof val === 'number') allAbsent = false; }
                        } else if (label.includes('TOT')) {
                            totVal = val;
                        } else if (label.includes('AIR')) {
                            airVal = val;
                        }
                    });

                    if (isOpt) return;

                    if (hasMarks) {
                        const numSum = Object.values(marks).filter(v => typeof v === 'number').reduce((a, b) => a + b, 0);
                        const finalTot = (typeof totVal === 'number' && totVal > 0) ? totVal : numSum;
                        student.streamTests.MEDICAL.push({
                            testName: tb.testName,
                            date: tb.date,
                            total: allAbsent ? '-' : finalTot,
                            marks,
                            air: airVal,
                            isAB: allAbsent
                        });
                    } else if (typeof totVal === 'number' && totVal > 0) {
                        student.streamTests.MEDICAL.push({
                            testName: tb.testName,
                            date: tb.date,
                            total: totVal,
                            marks: {},
                            air: airVal,
                            isAB: false
                        });
                    }
                } else {
                    const marks = {};
                    let totVal = null;
                    let hasMarks = false;

                    tb.cols.forEach(ci => {
                        const raw = row[ci.colIdx];
                        const val = parseNumericOrMark(raw);
                        const sub = (ci.bot || ci.mid || ci.top).toUpperCase();

                        if (sub.includes('ENG')) {
                            if (val !== null) { marks['ENGLISH'] = val; hasMarks = true; }
                        } else if (sub.includes('BIO')) {
                            if (val !== null) { marks['BIOLOGY'] = val; hasMarks = true; }
                        } else if (sub.includes('PHY')) {
                            if (val !== null) { marks['PHYSICS'] = val; hasMarks = true; }
                        } else if (sub.includes('CHE')) {
                            if (val !== null) { marks['CHEMISTRY'] = val; hasMarks = true; }
                        } else if (sub.includes('MAT')) {
                            if (val !== null && (typeof val !== 'number' || val > 0)) { marks['MATHS'] = val; hasMarks = true; }
                        } else if (sub.includes('IP')) {
                            if (val !== null && (typeof val !== 'number' || val > 0)) { marks['IP'] = val; hasMarks = true; }
                        } else if (sub.includes('PE')) {
                            if (val !== null && (typeof val !== 'number' || val > 0)) { marks['PE'] = val; hasMarks = true; }
                        } else if (sub.includes('KAN')) {
                            if (val !== null && (typeof val !== 'number' || val > 0)) { marks['KANNADA'] = val; hasMarks = true; }
                        } else if (sub.includes('HIN')) {
                            if (val !== null && (typeof val !== 'number' || val > 0)) { marks['HINDI'] = val; hasMarks = true; }
                        } else if (sub.includes('SAN')) {
                            if (val !== null && (typeof val !== 'number' || val > 0)) { marks['SANSKRIT'] = val; hasMarks = true; }
                        } else if (sub.includes('CS') || sub.includes('COMP')) {
                            if (val !== null && (typeof val !== 'number' || val > 0)) { marks['COMPUTER SCIENCE'] = val; hasMarks = true; }
                        } else if (sub.includes('ELE')) {
                            if (val !== null && (typeof val !== 'number' || val > 0)) { marks['ELECTRONICS'] = val; hasMarks = true; }
                        } else if (sub.includes('TOT')) {
                            totVal = val;
                        }
                    });

                    if (hasMarks) {
                        const numSum = Object.values(marks).filter(v => typeof v === 'number').reduce((a, b) => a + b, 0);
                        const finalTot = (typeof totVal === 'number' && totVal > 0) ? totVal : numSum;
                        student.streamTests[boardKey].push({
                            testName: 'Pre-Mid-Term Board Exam',
                            date: tb.date || '2025-10-27',
                            total: finalTot,
                            marks,
                            isAB: false
                        });
                    }
                }
            });

            students.push(student);
        });
    });

    return students;
}

function getVal(c) {
    if (!c || c.value === null || c.value === undefined) return '';
    if (typeof c.value === 'object') {
        if (c.value.result !== undefined && c.value.result !== null) return c.value.result;
        if (c.value.text !== undefined) return c.value.text;
        if (c.value instanceof Date) return c.value.toISOString().split('T')[0];
        return '';
    }
    return c.value;
}

async function testUserFile() {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile('C:/Users/Administrator/.gemini/antigravity/brain/8fbdb510-dcfa-425a-9491-b1e42849ba76/.user_uploaded/media_1795584830408_b9715aee.xlsx');
    
    let allStudents = [];
    wb.worksheets.forEach(ws => {
        const rows = [];
        ws.eachRow({ includeEmpty: false }, row => {
            const rVals = [];
            for (let col = 1; col <= ws.columnCount; col++) {
                const val = getVal(row.getCell(col));
                rVals.push(val !== undefined && val !== null ? String(val).trim() : '');
            }
            rows.push(rVals);
        });
        console.log('Worksheet:', ws.name, 'Rows extracted:', rows.length);
        if (isHorizontalLedger(rows)) {
            const studs = parseHorizontalLedger(rows);
            console.log('  -> Parsed', studs.length, 'students from', ws.name);
            allStudents.push(...studs);
        } else {
            console.log('  -> Not detected as horizontal ledger!');
        }
    });

    console.log('Total students parsed across sheets:', allStudents.length);
    if (allStudents.length > 0) {
        const s1 = allStudents[0];
        console.log('Sample CBSE Student:', s1.name, s1.id, s1.board, 'Medical tests:', s1.streamTests.MEDICAL.length, 'CBSE tests:', s1.streamTests.CBSE.length);
        console.log('Medical tests summary:', s1.streamTests.MEDICAL.map(t => `${t.testName}: Tot=${t.total}`));
        console.log('CBSE tests summary:', s1.streamTests.CBSE.map(t => `${t.testName}: Tot=${t.total}, Marks=${JSON.stringify(t.marks)}`));

        const puStud = allStudents.find(s => s.board.toUpperCase().includes('STATE') || s.board.toUpperCase().includes('PU'));
        if (puStud) {
            console.log('\nSample PU Student:', puStud.name, puStud.id, puStud.board, 'Medical tests:', puStud.streamTests.MEDICAL.length, 'PU tests:', puStud.streamTests.PU.length);
            console.log('Attendance:', JSON.stringify(puStud.attendance));
            console.log('Medical tests summary:', puStud.streamTests.MEDICAL.map(t => `${t.testName}: Tot=${t.total}`));
            console.log('PU tests summary:', puStud.streamTests.PU.map(t => `${t.testName}: Tot=${t.total}, Marks=${JSON.stringify(t.marks)}`));
        }
    }
}
testUserFile().catch(console.error);
