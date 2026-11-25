const fs = require('fs');
const content = fs.readFileSync('scratch/user_sample.csv', 'utf8');
const { parseCSV } = require('./parse_util.js');

const rawRows = parseCSV(content);

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
    if (str.toUpperCase() === 'OPT') return 'OPT';
    if (str.toUpperCase() === 'AB' || str.toUpperCase() === 'A' || str.toUpperCase() === 'AN') return 'AB';
    if (str.toUpperCase() === 'SICK') return 'SICK';
    if (str.includes('W') && str.includes('R') && str.includes('O')) return 'WRONG ID';
    const num = Number(str);
    if (!isNaN(num)) return num;
    return str;
}

// Find table sections
const tableSections = [];
let currentSection = null;

rawRows.forEach((r, idx) => {
    if (r[0] === 'S NO' && r[3] && r[3].toUpperCase().includes('NAME')) {
        if (currentSection) {
            tableSections.push(currentSection);
        }
        currentSection = {
            headerRowIdx: idx,
            headerRow: r,
            subHeader1: rawRows[idx + 1] || [],
            subHeader2: rawRows[idx + 2] || [],
            dataRows: []
        };
    } else if (currentSection && idx > currentSection.headerRowIdx + 2) {
        // Data row
        if (r.some(c => c !== '')) {
            currentSection.dataRows.push(r);
        }
    }
});
if (currentSection) tableSections.push(currentSection);

console.log(`Found ${tableSections.length} table section(s).`);

const allStudents = [];

tableSections.forEach((sec, sIdx) => {
    const h0 = sec.headerRow;
    const h1 = sec.subHeader1;
    const h2 = sec.subHeader2;
    console.log(`\nSection ${sIdx + 1}: ${sec.dataRows.length} data rows`);

    // Detect if CBSE or STATE/PU
    const secStr = h0.join(' ') + ' ' + h1.join(' ') + ' ' + h2.join(' ');
    const isCBSE = secStr.toUpperCase().includes('CBSE');
    const isState = secStr.toUpperCase().includes('STATE') || secStr.toUpperCase().includes('PU');

    // Parse column test groups from h0, h1, h2
    // Scan h0 for test headers
    const testBlocks = [];
    let currentBlock = null;

    for (let c = 6; c < h0.length; c++) {
        const topH = (h0[c] || '').trim();
        const midH = (h1[c] || '').trim();
        const botH = (h2[c] || '').trim();

        if (topH.toUpperCase().includes('WET') || topH.toUpperCase().includes('UT-') || topH.toUpperCase().includes('PRE-MID-TERM')) {
            if (currentBlock) testBlocks.push(currentBlock);
            currentBlock = {
                startCol: c,
                endCol: c,
                rawName: topH,
                testName: parseTestName(topH),
                date: parseDateStr(topH),
                isBoard: topH.toUpperCase().includes('PRE-MID-TERM'),
                cols: []
            };
        } else if (topH.toUpperCase().includes('ATTENDANCE')) {
            if (currentBlock) testBlocks.push(currentBlock);
            currentBlock = {
                startCol: c,
                endCol: c,
                rawName: 'ATTENDANCE',
                testName: 'ATTENDANCE',
                isAttendance: true,
                cols: []
            };
        } else if (currentBlock) {
            currentBlock.endCol = c;
        }

        if (currentBlock) {
            currentBlock.cols.push({
                colIdx: c,
                top: topH,
                mid: midH,
                bot: botH
            });
        }
    }
    if (currentBlock) testBlocks.push(currentBlock);

    console.log(`Detected ${testBlocks.length} test block(s):`, testBlocks.map(b => `${b.testName} (${b.cols.length} cols)`));

    // Process students
    sec.dataRows.forEach(row => {
        const studId9 = (row[1] || '').trim();
        const studId7 = (row[2] || '').trim();
        const studId = studId7 || studId9;
        const name = (row[3] || '').trim();
        const board = (row[4] || '').trim() || (isCBSE ? 'CBSE' : 'STATE');
        const section = (row[5] || '').trim();

        if (!name && !studId) return;

        const student = {
            id: studId,
            id9: studId9,
            name,
            campus: 'Campus',
            board,
            section,
            stream: isCBSE ? 'Medical (NEET) & CBSE Board' : 'Medical (NEET) & PU Board',
            streamTests: {
                MEDICAL: [],
                [isCBSE ? 'CBSE' : 'PU']: []
            },
            attendance: null
        };

        // Extract each test block
        testBlocks.forEach(tb => {
            if (tb.isAttendance) {
                // attendance
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
                // NEET test
                const marks = {};
                let totVal = null;
                let airVal = null;
                let hasMarks = false;
                let allAbsent = true;
                let isOpt = false;

                tb.cols.forEach((colInfo, cOffset) => {
                    const rawVal = row[colInfo.colIdx];
                    const val = parseNumericOrMark(rawVal);
                    if (val === 'OPT') isOpt = true;

                    const label = (colInfo.bot || colInfo.mid || colInfo.top).toUpperCase();
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

                if (isOpt) return; // Opted out

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
                // Board Exam (Pre-Mid-Term)
                const boardKey = isCBSE ? 'CBSE' : 'PU';
                const marks = {};
                let totVal = null;
                let hasMarks = false;

                tb.cols.forEach(colInfo => {
                    const rawVal = row[colInfo.colIdx];
                    const val = parseNumericOrMark(rawVal);
                    const subLabel = (colInfo.bot || colInfo.mid || colInfo.top).toUpperCase();

                    if (subLabel.includes('ENG')) {
                        if (val !== null) { marks['ENGLISH'] = val; hasMarks = true; }
                    } else if (subLabel.includes('BIO')) {
                        if (val !== null) { marks['BIOLOGY'] = val; hasMarks = true; }
                    } else if (subLabel.includes('PHY')) {
                        if (val !== null) { marks['PHYSICS'] = val; hasMarks = true; }
                    } else if (subLabel.includes('CHE')) {
                        if (val !== null) { marks['CHEMISTRY'] = val; hasMarks = true; }
                    } else if (subLabel.includes('MAT')) {
                        if (val !== null && (typeof val !== 'number' || val > 0)) { marks['MATHS'] = val; hasMarks = true; }
                    } else if (subLabel.includes('IP')) {
                        if (val !== null && (typeof val !== 'number' || val > 0)) { marks['IP'] = val; hasMarks = true; }
                    } else if (subLabel.includes('PE')) {
                        if (val !== null && (typeof val !== 'number' || val > 0)) { marks['PE'] = val; hasMarks = true; }
                    } else if (subLabel.includes('KAN')) {
                        if (val !== null && (typeof val !== 'number' || val > 0)) { marks['KANNADA'] = val; hasMarks = true; }
                    } else if (subLabel.includes('HIN')) {
                        if (val !== null && (typeof val !== 'number' || val > 0)) { marks['HINDI'] = val; hasMarks = true; }
                    } else if (subLabel.includes('SAN')) {
                        if (val !== null && (typeof val !== 'number' || val > 0)) { marks['SANSKRIT'] = val; hasMarks = true; }
                    } else if (subLabel.includes('CS') || subLabel.includes('COMP')) {
                        if (val !== null && (typeof val !== 'number' || val > 0)) { marks['COMPUTER SCIENCE'] = val; hasMarks = true; }
                    } else if (subLabel.includes('ELE')) {
                        if (val !== null && (typeof val !== 'number' || val > 0)) { marks['ELECTRONICS'] = val; hasMarks = true; }
                    } else if (subLabel.includes('TOT')) {
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

        allStudents.push(student);
    });
});

console.log(`\nSuccessfully parsed ${allStudents.length} total students!`);
console.log('Sample Student 1 (CBSE):');
console.log(JSON.stringify(allStudents[0], null, 2));

console.log('\nSample Student (STATE/PU):');
const stateStud = allStudents.find(s => s.board === 'STATE');
console.log(JSON.stringify(stateStud, null, 2));
